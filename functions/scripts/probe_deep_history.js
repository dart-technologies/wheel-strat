#!/usr/bin/env node
const { loadEnv } = require('./lib/env');
const { parseArgs, parseNumber } = require('./lib/args');
const { createLogger } = require('./lib/logger');
const {
    getBridgeUrl,
    getBridgeApiKey
} = require('../../scripts/lib/ibkrBridgeConfig');

const logger = createLogger('probe-history');

function toIbkrEndDateTime(date) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')} 23:59:59`;
}

async function fetchJson(url, payload, apiKey, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey || '',
                'ngrok-skip-browser-warning': '1'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        const body = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
        return JSON.parse(body);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function probePoint(bridgeUrl, apiKey, symbol, yearsAgo, barSize) {
    const end = new Date();
    end.setFullYear(end.getFullYear() - yearsAgo);
    
    // Adjust to ensure we don't land on a weekend if possible (simple heuristic)
    const day = end.getUTCDay();
    if (day === 0) end.setDate(end.getDate() - 2); // Sun -> Fri
    if (day === 6) end.setDate(end.getDate() - 1); // Sat -> Fri

    const url = `${bridgeUrl.replace(/\/$/, '')}/historical`;
    const payload = {
        symbol,
        duration: '1 W', // Request small chunk
        barSize,
        endDateTime: toIbkrEndDateTime(end),
        useRTH: true
    };

    try {
        const start = Date.now();
        const response = await fetchJson(url, payload, apiKey);
        const elapsed = Date.now() - start;
        const bars = Array.isArray(response?.bars) ? response.bars : [];
        if (!bars.length) return { ok: false, year: yearsAgo, date: toIbkrEndDateTime(end), reason: 'No bars returned', elapsed };
        return { ok: true, year: yearsAgo, date: toIbkrEndDateTime(end), count: bars.length, first: bars[0].date, last: bars[bars.length - 1].date, elapsed };
    } catch (error) {
        return { ok: false, year: yearsAgo, date: toIbkrEndDateTime(end), reason: error.message, elapsed: 0 };
    }
}

async function main() {
    const loaded = loadEnv();
    loaded.forEach((envPath) => logger.info(`Loaded env from ${envPath}`));
    const args = parseArgs(process.argv.slice(2));
    const symbol = (args.symbol || 'AMZN').toUpperCase();
    const barSize = args['bar-size'] || '1 min';
    const delayMs = parseNumber(args['sleep-ms'], 1000);
    
    const bridgeUrl = getBridgeUrl(process.env, args['bridge-url']);
    const apiKey = getBridgeApiKey(process.env, args['api-key']);

    if (!bridgeUrl || !apiKey) {
        logger.error('Missing bridge URL or API key.');
        process.exit(1);
    }

    logger.info(`=== Deep History Probe: ${symbol} (${barSize}) ===`);
    logger.info(`Bridge: ${bridgeUrl}`);

    // Probe 0 to 10 years back in 0.5 year increments
    const checkpoints = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
    
    for (const years of checkpoints) {
        const result = await probePoint(bridgeUrl, apiKey, symbol, years, barSize);
        if (result.ok) {
            logger.info(`✅ ${years.toFixed(1)} years ago (~${result.date}): Found ${result.count} bars.`);
        } else {
            logger.warn(`❌ ${years.toFixed(1)} years ago (~${result.date}): Failed (${result.reason})`);
        }
        // Small delay to be nice to the bridge
        await new Promise((r) => setTimeout(r, delayMs));
    }
}

main().catch((err) => logger.error(err));
