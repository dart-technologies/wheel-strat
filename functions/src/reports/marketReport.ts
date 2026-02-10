import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getGenerativeModel } from "@/lib/vertexai";
import { MARKET_REPORT_PROMPT } from "@/prompts/marketReport";
import { HistoricalRepository } from "@/lib/historicalRepository";
import { ReportData, YieldComparison } from "./marketReportTypes";
import { generateMarketReportHtml } from "./marketReportTemplate";
import {
    buildCalendarEventsLabel,
    mergeKeyDates,
    normalizeReportData
} from "./marketReportUtils";

const historicalRepo = new HistoricalRepository();

export const __test__ = {
    normalizeReportData,
    mergeKeyDates,
    buildCalendarEventsLabel
};

/**
 * Generates a shareable market report with macro analysis and CC/CSP yield comparison
 * Called by runMarathonAgent after scanning
 */
export async function generateMarketReportInternal(
    session: "open" | "close",
    positions: Array<{ symbol: string; quantity: number; currentPrice: number }>,
    opportunities: YieldComparison[],
    reportIdOverride?: string,
    prefillKeyDates: ReportData["keyDates"] = []
): Promise<{ reportId: string; reportUrl: string; headline?: string }> {
    const generativeModel = getGenerativeModel("gemini-3-flash-preview", [{ googleSearch: {} }]);
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0];
    const reportId = reportIdOverride || `${today}-${session}`;
    const projectId = process.env.GCLOUD_PROJECT ||
        (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : 'wheel-strat');
    const reportUrl = `https://${projectId}.web.app/reports/${reportId}`;
    const testflightUrl = process.env.TESTFLIGHT_URL || process.env.EXPO_PUBLIC_TESTFLIGHT_URL || 'https://testflight.apple.com/';
    const logoUrl = process.env.REPORT_LOGO_URL || `https://${projectId}.web.app/icon.png`;

    console.log(`📊 Generating market report: ${reportId}`);

    // Fetch Prior Context (Last 3 reports)
    const priorReportsSnapshot = await db.collection('reports')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();
    
    const priorContextStr = priorReportsSnapshot.docs.map(doc => {
        const d = doc.data();
        return `[${d.date} ${d.session}] Headline: ${d.headline} | Bias: ${d.marketBias}\nAnalysis: ${d.macroAnalysis}`;
    }).join('\n\n');

    // Fetch Historical Context
    const symbols = [...new Set([...positions.map(p => p.symbol), ...opportunities.map(o => o.symbol)])];
    const priceMap: Record<string, number> = {};
    positions.forEach((position) => {
        if (Number.isFinite(position.currentPrice)) {
            priceMap[position.symbol] = position.currentPrice;
        }
    });
    opportunities.forEach((opp) => {
        const priceHint = Number.isFinite(opp.currentPrice)
            ? opp.currentPrice
            : Number.isFinite(opp.strike)
                ? opp.strike
                : undefined;
        if (priceHint !== undefined) {
            priceMap[opp.symbol] = priceHint;
        }
    });
    const historicalContext = await historicalRepo.getHistoricalContext(symbols, priceMap);
    const hasHistoricalData = Object.values(historicalContext).some((context) => {
        if (!context?.priceHistory?.length) return false;
        return context.source !== 'synthetic';
    });

    // Enrich opportunities with history
    const enrichedOpportunities = opportunities.map(op => ({
        ...op,
        history: historicalContext[op.symbol] ?? null
    }));

    // Format positions for prompt - STREAMLINED: Shares Only
    // Filter out options (checking for typical option properties if they exist in the input objects)
    const shareOnlyPositions = positions.filter(p => {
        const raw = p as any;
        return !raw.strike && !raw.expiration && !raw.right && p.quantity > 0;
    });

    const positionsStr = shareOnlyPositions
        .map(p => `${p.symbol}: ${p.quantity} shares @ $${p.currentPrice}`)
        .join('\n');

    // Format opportunities for prompt
    const oppsStr = enrichedOpportunities
        .map(o => {
            const rsi = o.history?.rsi_14 ? `, RSI:${o.history.rsi_14.toFixed(0)}` : '';
            return `${o.symbol} ${o.strategy}: $${o.strike} exp ${o.expiration}, ${o.annualizedYield}% yield${rsi}`;
        })
        .join('\n');

    // Generate macro analysis
    let reportData: ReportData = {
        macroAnalysis: "Market analysis unavailable.",
        keyDates: [],
        vixLevel: 0,
        marketBias: "neutral"
    };

    try {
        const calendarEvents = buildCalendarEventsLabel(prefillKeyDates);
        const prompt = MARKET_REPORT_PROMPT
            .replace("{{today}}", today)
            .replace("{{session}}", session === "open" ? "Open (9:30 AM ET)" : "Close (3:30 PM ET)")
            .replace("{{positions}}", positionsStr || "No share positions")
            .replace("{{opportunities}}", oppsStr || "No opportunities identified")
            .replace("{{priorContext}}", priorContextStr || "No prior reports available.")
            .replace("{{calendarEvents}}", calendarEvents);

        const result = await generativeModel.generateContent(prompt);
        const text = result.text();

        if (text) {
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            reportData = normalizeReportData(JSON.parse(jsonStr));
            console.log(`✅ Macro analysis generated: ${reportData.marketBias}`);
        }
    } catch (error) {
        console.error("Error generating macro analysis:", error);
    }
    reportData.keyDates = mergeKeyDates(prefillKeyDates, reportData.keyDates);

    if (!reportData.headline || reportData.headline === "Market Scan Update") {
        reportData.headline = session === "open"
            ? "Market Open Scan: Fresh Setups"
            : "Market Close Scan: Setup Recap";
    }

    // Generate Synopsis & Featured Deep Dive
    let synopsis = "";
    let featuredList: any[] = []; // Array of featured deep dives

    try {
        const sortedByYield = [...enrichedOpportunities].sort((a, b) => {
            const aYield = Number.isFinite(a.annualizedYield) ? a.annualizedYield : 0;
            const bYield = Number.isFinite(b.annualizedYield) ? b.annualizedYield : 0;
            return bYield - aYield;
        });
        const topOpps = sortedByYield.slice(0, 3);

        // Loop through top 3 for deep dive
        for (const featured of topOpps) {
            try {
                const expMs = Date.parse(featured.expiration);
                const daysToExp = Number.isFinite(expMs)
                    ? Math.max(1, Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 30;
                const currentPrice = typeof featured.currentPrice === 'number' && Number.isFinite(featured.currentPrice)
                    ? featured.currentPrice
                    : undefined;
                const historyPrice = featured.history?.priceHistory?.[featured.history.priceHistory.length - 1];
                const priceHint = currentPrice ?? historyPrice ?? featured.strike;
                const safePriceHint = Number.isFinite(priceHint) ? priceHint : featured.strike;
                const backtest = await historicalRepo.calculateFlashBacktest(
                    featured.symbol,
                    safePriceHint,
                    featured.strike,
                    daysToExp
                );

                // Featured Data for HTML
                featuredList.push({
                    symbol: featured.symbol,
                    backtest,
                    chartId: `chart-${featured.symbol}`,
                    strike: featured.strike,
                    premium: featured.premium,
                    analysis: null,
                    // P/L Data for Chart.js
                    // Simple P/L at exp: range of prices +/- 20%
                    plLabels: [-0.2, -0.1, 0, 0.1, 0.2].map(p => (featured.strike * (1 + p)).toFixed(2)),
                    plData: [-0.2, -0.1, 0, 0.1, 0.2].map(p => {
                        const price = featured.strike * (1 + p);
                        // Short Put: Max gain = premium. Loss = Strike - Price - Premium
                        const intrinsic = Math.max(0, featured.strike - price);
                        return (featured.premium - intrinsic).toFixed(2);
                    })
                });
            } catch (error) {
                console.error(`Deep dive generation failed for ${featured.symbol}:`, error);
                featuredList.push({
                    symbol: featured.symbol,
                    backtest: null,
                    chartId: `chart-${featured.symbol}`,
                    strike: featured.strike,
                    premium: featured.premium,
                    analysis: null,
                    plLabels: [],
                    plData: []
                });
            }
        }

        const synopsisPrompt = `
        You are a friendly, expert options analyst writing for newer investors.
        
        1. Write a 2-3 sentence synopsis that is approachable but insight-dense for these opportunities: ${JSON.stringify(topOpps)}.
           - Use plain language, define any jargon quickly, and emphasize the "so-what."
        2. For EACH of the top opportunities (${topOpps.map(o => o.symbol).join(', ')}), use Google Search to find ONE specific recent news headline or catalyst that explains its recent moves.
           - Explain WHY this trade makes sense given that catalyst.
        
        Output format: JSON
        {
            "synopsis": "...",
            "analyses": {
                "SYMBOL": "analysis here",
                "SYMBOL2": "analysis here"
            }
        }
        `;

        const result = await generativeModel.generateContent(synopsisPrompt);
        const text = result.text();
        if (text) {
            const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            synopsis = json.synopsis;

            // Map AI analysis back to featuredList
            if (json.analyses) {
                featuredList.forEach(f => {
                    if (json.analyses[f.symbol]) {
                        f.analysis = json.analyses[f.symbol];
                    }
                });
            }
        }

        // PERSISTENCE: Save Deep Dive data back to 'opportunities' collection for App access
        const batch = db.batch();
        for (const f of featuredList) {
            const ref = db.collection('opportunities').doc(f.symbol);
            batch.set(ref, {
                deepDive: {
                    backtest: f.backtest,
                    analysis: f.analysis ?? null,
                    plLabels: f.plLabels,
                    plData: f.plData,
                    generatedAt: admin.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });
        }
        await batch.commit();
        console.log(`💾 Persisted deep dive data for ${featuredList.length} opportunities`);

    } catch (error) {
        console.error("Error generating synopsis:", error);
    }

    // Build yield comparison table
    const yieldTable: YieldComparison[] = enrichedOpportunities.map((opp) => ({
        ...opp,
        history: opp.history ?? null,
        risk: opp.strategy === "Covered Call"
            ? `Called away above $${opp.strike}`
            : `Assigned at $${opp.strike}`,
        reward: `${opp.annualizedYield}% annualized yield`
    }));

    // Generate HTML report
    const html = generateMarketReportHtml(
        reportId,
        session,
        { ...reportData, synopsis },
        yieldTable,
        featuredList,
        { reportUrl, logoUrl, testflightUrl, hasHistoricalData }
    );

    // Store in Firestore
    await db.collection('reports').doc(reportId).set({
        id: reportId,
        session,
        date: today,
        headline: reportData.headline,
        macroAnalysis: reportData.macroAnalysis,
        synopsis,
        featuredDeets: featuredList, // Save array
        keyDates: reportData.keyDates,
        vixLevel: reportData.vixLevel,
        marketBias: reportData.marketBias,
        yieldComparison: yieldTable,
        reportUrl,
        html,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`📊 Report saved: ${reportUrl}`);

    return { reportId, reportUrl, headline: reportData.headline };
}

/**
 * HTTP endpoint to fetch and render a report
 * Serves the stored HTML for public access
 */
export const getMarketReport = onRequest(async (req, res) => {
    const pathSegments = req.path.split('/').filter(Boolean);
    let reportId = pathSegments[pathSegments.length - 1];

    // In some hosting setups, path might be 'reports/id' or just 'id' depending on the rewrite
    if (pathSegments.includes('reports') && pathSegments.indexOf('reports') === pathSegments.length - 1) {
        reportId = ""; // It was just /reports/
    }
    const db = admin.firestore();

    if (!reportId) {
        // No ID provided? Fetch the latest report
        try {
            const latestSnapshot = await db.collection('reports')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (latestSnapshot.empty) {
                res.status(404).send("No reports found. Run the Marathon Agent to generate one.");
                return;
            }

            const doc = latestSnapshot.docs[0];
            const data = doc.data();
            console.log(`Serving latest report: ${doc.id}`);
            res.set('Content-Type', 'text/html');
            res.send(data?.html || "No content");
            return;
        } catch (error) {
            console.error("Error fetching latest report:", error);
            res.status(500).send("Internal Server Error");
            return;
        }
    }

    const doc = await db.collection('reports').doc(reportId).get();

    if (!doc.exists) {
        res.status(404).send(`
            <html>
            <body style="background:#0a0a0f;color:#f4f4f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center">
                    <h1>Report Not Found</h1>
                    <p>Report ${reportId} does not exist.</p>
                </div>
            </body>
            </html>
        `);
        return;
    }

    const data = doc.data();
    res.set('Content-Type', 'text/html');
    res.send(data?.html || "No content");
});
