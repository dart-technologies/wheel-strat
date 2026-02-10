import { ReportData, YieldComparison } from "./marketReportTypes";
import { generateSparkline } from "./marketReportTemplateUtils";
import { getMarketReportStyles } from "./marketReportTemplateStyles";

/**
 * Generate styled HTML for the report
 */
export const generateMarketReportHtml = (
    reportId: string,
    session: "open" | "close",
    data: ReportData,
    yieldTable: YieldComparison[],
    featuredList: any[] = [],
    branding?: {
        reportUrl?: string;
        logoUrl?: string;
        testflightUrl?: string;
        hasHistoricalData?: boolean;
    }
): string => {
    const biasColor = data.marketBias === "bullish" ? "#22c55e"
        : data.marketBias === "bearish" ? "#ef4444"
            : "#a78bfa";
    const reportUrl = branding?.reportUrl || '';
    const logoUrl = branding?.logoUrl || '';
    const testflightUrl = branding?.testflightUrl || 'https://testflight.apple.com/';
    const metaDescription = (data.synopsis || data.macroAnalysis || '')
        .replace(/"/g, '&quot;')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
    const historicalAvailable = typeof branding?.hasHistoricalData === 'boolean'
        ? branding.hasHistoricalData
        : yieldTable.some((row) => Boolean(row.history?.priceHistory?.length));
    const statusBanner = historicalAvailable
        ? ''
        : `<div class="status-alert">System Status: Degraded (Historical Data Unavailable)</div>`;
    const medals = ['🥇', '🥈', '🥉'];
    const topYieldTable = [...yieldTable]
        .sort((a, b) => (b.annualizedYield || 0) - (a.annualizedYield || 0))
        .slice(0, 3);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wheel Strat | ${reportId}</title>
    <meta name="description" content="${metaDescription}">
    <meta property="og:title" content="${data.headline || `Wheel Strat Market Scan`}">
    <meta property="og:description" content="${metaDescription}">
    ${reportUrl ? `<meta property="og:url" content="${reportUrl}">` : ''}
    ${logoUrl ? `<meta property="og:image" content="${logoUrl}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
${getMarketReportStyles(biasColor)}
    </style>
</head>
<body>
    <div class="promo-header">
        <div class="promo-left">
            ${logoUrl ? `<img class="app-logo" src="${logoUrl}" alt="Wheel Strat logo" />` : ''}
            <div>
                <div class="promo-title">Download TestFlight</div>
                <div class="promo-sub">Get the Wheel Strat beta for live market scans.</div>
            </div>
        </div>
        <a class="promo-button" href="${testflightUrl}" target="_blank" rel="noopener">Get the beta</a>
    </div>
    <div class="report-header">
        <div class="report-title">📊 Market Scan Report <span class="bias-badge">${data.marketBias}</span></div>
        <div class="meta">${reportId.replace('-open', ' • Open').replace('-close', ' • Close')} | VIX: ${data.vixLevel || 'N/A'}</div>
        ${data.headline ? `<div class="headline">${data.headline}</div>` : ''}
    </div>
    ${statusBanner}

    <div class="section">
        <h2>Macro Outlook Analysis</h2>
        ${data.synopsis ? `<p class="synopsis-text">${data.synopsis}</p>` : ''}
        <p class="macro-text">${data.macroAnalysis}</p>
    </div>

    ${data.keyDates.length > 0 ? `
    <div class="section">
        <h2>Key Calendar Dates</h2>
        <ul class="dates-list">
            ${data.keyDates.map(d => `
                <li>
                    <span><strong>${d.date}</strong>: ${d.event}</span>
                    <span class="impact-${d.impact}">${d.impact.toUpperCase()}</span>
                </li>
            `).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="section">
        <h2>Top 3 Opportunities (CC/CSP Yield Comparison)</h2>
        ${topYieldTable.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Symbol</th>
                    <th>Strategy</th>
                    <th>Strike/Exp</th>
                    <th>Trend (30d)</th>
                    <th>Yield</th>
                    <th>Context</th>
                </tr>
            </thead>
            <tbody>
                ${topYieldTable.map((row, index) => {
        const medal = medals[index] ? `${medals[index]} ` : '';
        const hist = row.history;
        const rsi = hist?.rsi_14 ?? 50;
        const rsiClass = rsi > 70 ? 'rsi-high' : rsi < 30 ? 'rsi-low' : 'rsi-mid';
        const rsiLabel = hist?.rsi_14 ? `RSI ${hist.rsi_14.toFixed(0)}` : '';

        const low = hist?.yearLow ?? 0;
        const high = hist?.yearHigh ?? 100;
        const curr = (row.strategy === 'Covered Call' ? row.strike : (row.strike / 0.95));
        const pct = Math.min(100, Math.max(0, ((curr - low) / (high - low)) * 100));
        const safePct = isNaN(pct) ? 50 : pct;

        return `
                    <tr>
                        <td>
                            <strong>${medal}${row.symbol}</strong>
                            <div style="font-size: 0.7rem; color: #71717a;">IVR ${row.ivRank || 'N/A'}</div>
                        </td>
                        <td class="${row.strategy === 'Covered Call' ? 'strategy-cc' : 'strategy-csp'}">
                            ${row.strategy}
                            ${rsiLabel ? `<span class="rsi-badge ${rsiClass}">${rsiLabel}</span>` : ''}
                        </td>
                        <td>
                            $${row.strike}<br>
                            <span style="font-size:0.75rem;color:#71717a">${row.expiration}</span>
                        </td>
                        <td class="sparkline-cell">
                            ${hist?.priceHistory ? generateSparkline(hist.priceHistory) : ''}
                        </td>
                        <td>
                            <div class="yield">${row.annualizedYield}%</div>
                            <div style="font-size:0.7rem;color:#71717a">Win ${row.winProb}%</div>
                        </td>
                         <td style="width: 100px;">
                            ${hist ? `
                            <div class="range-bar">
                                <div class="range-fill" style="width: ${safePct}%;"></div>
                            </div>
                            <div class="range-label">
                                <span>$${Math.round(low)}</span>
                                <span>$${Math.round(high)}</span>
                            </div>
                            ` : `<span style="font-size:0.7rem;color:#71717a">N/A</span>`}
                        </td>
                    </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
        ` : `<p class="section-note">No opportunities identified in this scan.</p>`}
    </div>

    ${featuredList && featuredList.length > 0 ? `
    <div class="section" style="background: transparent; border: none; padding: 0;">
        <h2 style="margin-bottom: 16px;">Featured Opportunities (Deep Dive)</h2>
        <div class="deep-dive-grid">
            ${featuredList.map((featured, index) => {
        const medal = medals[index] ? `${medals[index]} ` : '';
        const winRate = Number.isFinite(featured.backtest?.winRate) ? featured.backtest.winRate : null;
        const maxLoss = Number.isFinite(featured.backtest?.maxLoss) ? featured.backtest.maxLoss : null;
        const winRateColor = winRate !== null ? (winRate > 90 ? '#22c55e' : '#f59e0b') : '#71717a';
        return `
            <div class="featured-card" style="padding: 20px; border-radius: 12px;">
                <h3>${medal}${featured.symbol} <span style="font-weight: 400; font-size: 0.8rem; color: #a78bfa;">$${featured.strike} Strike</span></h3>
                <p class="macro-text" style="font-size: 0.85rem; margin-bottom: 16px; min-height: 80px;">
                    ${featured.analysis || "AI Analysis unavailable."}
                </p>

                <div class="backtest-grid">
                    <div class="stat-box">
                        <div class="stat-label">Historical Win Rate</div>
                        <div class="stat-val" style="color: ${winRateColor}">
                            ${winRate !== null ? `${winRate}%` : '--'}
                        </div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Max Loss (Sim)</div>
                        <div class="stat-val" style="color: #ef4444">
                            ${maxLoss !== null ? `${maxLoss}%` : '--'}
                        </div>
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="${featured.chartId}"></canvas>
                </div>
            </div>
            `;
    }).join('')}
        </div>

        <script>
            const chartData = ${JSON.stringify(featuredList)};
            chartData.forEach(item => {
                const ctx = document.getElementById(item.chartId);
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: item.plLabels,
                        datasets: [{
                            label: 'P/L at Expiration',
                            data: item.plData,
                            borderColor: '#a78bfa',
                            backgroundColor: 'rgba(167, 139, 250, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                            x: { grid: { color: 'rgba(255,255,255,0.05)' } }
                        }
                    }
                });
            });
        </script>
    </div>
    ` : ''}

    <div class="footer">
        Generated by Wheel Strat AI • ${new Date().toISOString()}
    </div>
</body>
</html>`;
};
