#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('../lib/cli');
const { loadEnv } = require('../lib/env');

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'];
const {
    getBridgeUrl,
    getBridgeApiKey
} = require('../lib/ibkrBridgeConfig');

const normalizeDate = (value) => {
    if (!value) return null;
    let str = String(value);
    if (str.includes(' ')) {
        str = str.split(' ')[0];
    }
    if (/^\d{8}$/.test(str)) {
        str = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    return str;
};

const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const computeMetrics = (bars) => {
    const closes = bars.map((b) => b.close).filter((n) => typeof n === 'number');
    const highs = bars.map((b) => b.high).filter((n) => typeof n === 'number');
    const lows = bars.map((b) => b.low).filter((n) => typeof n === 'number');
    const yearHigh = closes.length ? Math.max(...closes) : null;
    const yearLow = closes.length ? Math.min(...closes) : null;

    const lookback = bars.slice(-90);
    const lookbackHighs = lookback.map((b) => b.high).filter((n) => typeof n === 'number');
    const lookbackLows = lookback.map((b) => b.low).filter((n) => typeof n === 'number');
    const resistance = lookbackHighs.length ? Math.max(...lookbackHighs) : null;
    const support = lookbackLows.length ? Math.min(...lookbackLows) : null;

    return { yearHigh, yearLow, resistance, support };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, payload, apiKey, timeoutMs) => {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is unavailable. Use Node 18+ or newer.');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey || ''
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body}`);
        }
        return await res.json();
    } finally {
        clearTimeout(timeoutId);
    }
};

const main = async () => {
    loadEnv({ cwd: path.resolve(__dirname, '../..') });
    const args = parseArgs(process.argv.slice(2));
    const env = { ...process.env };
    if (args.profile) {
        env.EXPO_PUBLIC_IBKR_BRIDGE_PROFILE = args.profile;
        env.IBKR_BRIDGE_PROFILE = args.profile;
    }
    const bridgeUrl = getBridgeUrl(env, args.bridgeUrl);
    const apiKey = getBridgeApiKey(env, args.apiKey);
    const duration = args.duration || '5 Y';
    const barSize = args.barSize || '1 day';
    const timeoutMs = Number(args.timeoutMs || 60000);

    if (!bridgeUrl) {
        console.error('Bridge URL not resolved. Set IBKR_BRIDGE_URL or pass --bridge-url.');
        process.exit(1);
    }
    if (!apiKey) {
        console.error('Missing IBKR bridge API key. Set IBKR_BRIDGE_API_KEY or pass --api-key.');
        process.exit(1);
    }

    const symbols = (args.symbols || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const targetSymbols = symbols.length ? symbols : DEFAULT_SYMBOLS;
    if (targetSymbols.length === 0) {
        console.error('No symbols provided.');
        process.exit(1);
    }

    const repoRoot = path.resolve(__dirname, '../..');
    const assetsDir = path.join(repoRoot, 'assets', 'data');
    fs.mkdirSync(assetsDir, { recursive: true });

    const output5y = path.join(assetsDir, 'mag7_history.json');
    const output1y = path.join(assetsDir, 'mag7_historical_1y.json');
    const timestamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    const data5y = {};
    const data1y = {};

    for (const symbol of targetSymbols) {
        const payload = { symbol, duration, barSize };
        const url = `${bridgeUrl.replace(/\/$/, '')}/historical`;
        console.log(`Fetching ${symbol} from ${url}...`);
        let response;
        try {
            response = await fetchJson(url, payload, apiKey, timeoutMs);
        } catch (error) {
            console.error(`Failed to fetch ${symbol}:`, error.message || error);
            process.exit(1);
        }

        const bars = Array.isArray(response?.bars) ? response.bars : [];
        if (!bars.length) {
            console.error(`No bars returned for ${symbol}.`);
            process.exit(1);
        }

        const normalized = bars.map((bar) => ({
            date: normalizeDate(bar.date),
            open: toNumber(bar.open),
            high: toNumber(bar.high),
            low: toNumber(bar.low),
            close: toNumber(bar.close),
            volume: Number.isFinite(Number(bar.volume)) ? Math.trunc(Number(bar.volume)) : 0,
            average: toNumber(bar.average)
        })).filter((bar) => bar.date);

        normalized.sort((a, b) => a.date.localeCompare(b.date));

        data5y[symbol] = normalized;

        const bars1y = normalized.length > 252 ? normalized.slice(-252) : normalized;
        data1y[symbol] = {
            symbol,
            bars: bars1y,
            metrics: computeMetrics(bars1y),
            lastUpdated: timestamp
        };

        await sleep(500);
    }

    fs.writeFileSync(output5y, `${JSON.stringify(data5y, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${output5y}`);

    fs.writeFileSync(output1y, `${JSON.stringify(data1y, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${output1y}`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
