import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { getGenerativeModel } from "@/lib/vertexai";
import { SCANNER_PROMPT } from "@/prompts/scanner";
import type { MarketSnapshot } from "@/lib/marketDataProvider";
import { buildTrackRecordSnippet, calculateDaysToEarnings } from "./agentUtils";

/**
 * Process a single candidate stock through AI analysis
 */
export async function processCandidate(
    stock: MarketSnapshot,
    db: admin.firestore.Firestore,
    batch: admin.firestore.WriteBatch,
    timestamp: admin.firestore.FieldValue,
    confidenceThreshold: number
) {
    const generativeModel = getGenerativeModel("gemini-3-flash-preview");
    try {
        const daysToEarnings = calculateDaysToEarnings(stock.earningsDate);
        const trackRecord = await buildTrackRecordSnippet(db, stock.symbol);

        // 2. AI Analysis (The sanity check)
        const prompt = SCANNER_PROMPT
            .replace("{{symbol}}", stock.symbol)
            .replace("{{currentPrice}}", stock.price.toString())
            .replace("{{strategy}}", "Put Write") // Default assumption for high IV
            .replace("{{strike}}", "ATM")
            .replace("{{expiration}}", "30-45 DTE")
            .replace("{{premium}}", "High")
            .replace("{{ivRank}}", typeof stock.ivRank === "number" ? stock.ivRank.toString() : "N/A")
            .replace("{{support}}", stock.support?.toString() ?? "N/A")
            .replace("{{resistance}}", stock.resistance?.toString() ?? "N/A")
            .replace("{{earningsDate}}", stock.earningsDate ?? "N/A")
            .replace("{{daysToEarnings}}", daysToEarnings)
            .replace("{{winProb}}", "N/A")
            .replace("{{annualizedYield}}", "N/A")
            .replace("{{portfolioContext}}", "None")
            .replace("{{trackRecord}}", trackRecord)
            .replace("{{today}}", new Date().toISOString().split("T")[0]);

        const result = await generativeModel.generateContent(prompt);
        const text = result.text();

        if (!text) return;

        // Clean and parse JSON
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const analysis = JSON.parse(jsonStr);

        // 3. Persist Opportunities if AI agrees
        if (analysis.confidence > confidenceThreshold) {
            const docRef = db.collection("opportunities").doc(stock.symbol);

            // Deduplication & Staleness Check
            const existingDoc = await docRef.get();
            const existing = existingDoc.data();
            const isStale = existing &&
                (Date.now() - existing.createdAt?.toMillis()) > 24 * 60 * 60 * 1000;

            // Only write if new, stale, or higher confidence
            if (!existingDoc.exists || isStale || analysis.confidence > (existing?.analysis?.confidence ?? 0)) {
                batch.set(docRef, {
                    ...stock,
                    analysis, // Store structured analysis
                    reasoning: analysis.verdict,
                    status: "new",
                    createdAt: timestamp
                });
                logger.info(`✅ Recommendation created for ${stock.symbol} (Score: ${analysis.confidence})`);
            } else {
                logger.info(`Skipping ${stock.symbol}: Lower confidence than existing recommendation.`);
            }
        } else {
            logger.info(`Skipping ${stock.symbol}: Confidence ${analysis.confidence} < Threshold ${confidenceThreshold}`);
        }

    } catch (error) {
        logger.error(`Error processing ${stock.symbol}:`, error);
    }
}
