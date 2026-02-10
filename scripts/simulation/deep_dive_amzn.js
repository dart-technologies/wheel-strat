/**
 * Deep Dive: AMZN 100-Day SMA Pivot Tracing
 * Lists all 69 matches and calculates the distribution of outcomes.
 */

const fs = require('fs');
const path = require('path');

// 1. Load Data
const historyPath = path.join(__dirname, '../../assets/data/mag7_history.json');
const allHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
const history = allHistory['AMZN'];

const windowSize = 30; // 30 days before/after
const matches = [];

console.log(`\n🔍 Tracing AMZN 100-Day SMA Pivot Matches...\n`);

for (let i = 200; i < history.length - windowSize; i++) {
    const subHistory = history.slice(0, i);
    const currentPrice = history[i].close;

    // SMA 100 Criteria
    const sma100 = subHistory.slice(-100).reduce((a, b) => a + b.close, 0) / 100;
    const isPivot = currentPrice <= sma100 * 1.01 && currentPrice >= sma100 * 0.99;

    if (isPivot) {
        // Capture trace: -30 to +30 days
        const startIdx = Math.max(0, i - windowSize);
        const endIdx = i + windowSize;
        const trace = history.slice(startIdx, endIdx + 1).map(b => b.close);

        // Normalize trace to current price (i)
        const pivotPrice = history[i].close;
        const normalizedTrace = trace.map(p => (p - pivotPrice) / pivotPrice);

        matches.push({
            date: history[i].date,
            pivotPrice: pivotPrice.toFixed(2),
            return30d: ((history[i + windowSize].close - pivotPrice) / pivotPrice * 100).toFixed(2),
            trace: normalizedTrace
        });
    }
}

// 2. Aggregate Results
const returns = matches.map(m => parseFloat(m.return30d));
const avgReturn = (returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2);
const minReturn = Math.min(...returns).toFixed(2);
const maxReturn = Math.max(...returns).toFixed(2);

console.log('--- MATCH LOG (First 10 and Last 10) ---');
matches.slice(0, 10).forEach(m => console.log(`Date: ${m.date} | Price: ${m.pivotPrice} | 30d Outcome: ${m.return30d}%`));
console.log('...');
matches.slice(-10).forEach(m => console.log(`Date: ${m.date} | Price: ${m.pivotPrice} | 30d Outcome: ${m.return30d}%`));

console.log('\n--- PERFORMANCE DISTRIBUTION ---');
console.log(`Total Matches: ${matches.length}`);
console.log(`Win Rate (>-2%): ${(returns.filter(r => r >= -2).length / returns.length * 100).toFixed(1)}%`);
console.log(`Average 30d Return: ${avgReturn}%`);
console.log(`Range: [${minReturn}% to ${maxReturn}%]`);

// 3. Distribution Tracing (For UI Visualization)
const distribution = [];
for (let t = 0; t < (windowSize * 2); t++) {
    const points = matches.map(m => m.trace[t]).filter(p => p !== undefined);
    points.sort((a, b) => a - b);

    distribution.push({
        t: t - windowSize, // -30 to +30
        p10: points[Math.floor(points.length * 0.1)],
        p50: points[Math.floor(points.length * 0.5)],
        p90: points[Math.floor(points.length * 0.9)],
    });
}

console.log('\n--- OVERLAY CHART DATA (Fan Chart Projection) ---');
console.log('T (Day) | 10th Pct (Bottom) | 50th Pct (Median) | 90th Pct (Top)');
[-30, -15, 0, 15, 30].forEach(t => {
    const d = distribution.find(d => d.t === t);
    console.log(`${t.toString().padEnd(7)} | ${(d.p10 * 100).toFixed(1).padEnd(17)}% | ${(d.p50 * 100).toFixed(1).padEnd(17)}% | ${(d.p90 * 100).toFixed(1)}%`);
});

console.log('\n✅ TRACING COMPLETE.');
