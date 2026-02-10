#!/usr/bin/env node
const path = require('path');
const { loadEnv } = require('../lib/env');
const { parseArgs } = require('../lib/cli');
const {
    getBridgeUrl,
    getBridgeApiKey
} = require('../lib/ibkrBridgeConfig');


async function fetchJson(url, payload, apiKey, timeoutMs = 60000) {
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
                'X-API-KEY': apiKey || '',
                'ngrok-skip-browser-warning': '1'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        const body = await res.text();
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${body}`);
        }
        return JSON.parse(body);
    } finally {
        clearTimeout(timeoutId);
    }
}

async function probeDuration(bridgeUrl, apiKey, symbol, duration, barSize, useRTH) {
    const url = `${bridgeUrl.replace(/\/$/, '')}/historical`;
    const payload = { symbol, duration, barSize, useRTH };
    try {
        const response = await fetchJson(url, payload, apiKey, 90000);
        const bars = Array.isArray(response?.bars) ? response.bars : [];
        if (!bars.length) {
            return { ok: false, duration, barSize, reason: 'no-bars' };
        }
        const first = bars[0]?.date;
        const last = bars[bars.length - 1]?.date;
        return { ok: true, duration, barSize, count: bars.length, first, last };
    } catch (error) {
        return { ok: false, duration, barSize, reason: error.message || String(error) };
    }
}

async function main() {
    loadEnv({ cwd: path.resolve(__dirname, '../..') });
    const args = parseArgs(process.argv.slice(2));
    const symbol = (args.symbol || 'AMZN').toUpperCase();
    const explicitBridgeUrl = args['bridge-url'];
    let bridgeUrl = getBridgeUrl(process.env, explicitBridgeUrl);
    const isValidUrl = bridgeUrl && /^https?:\/\//i.test(bridgeUrl);
    if (!isValidUrl && explicitBridgeUrl) {
        console.error(`Invalid bridge URL provided: ${bridgeUrl}`);
        process.exit(1);
    }
    if (!isValidUrl) {
        const fallbackEnv = { ...process.env };
        delete fallbackEnv.IBKR_BRIDGE_URL;
        delete fallbackEnv.EXPO_PUBLIC_IBKR_BRIDGE_URL;
        bridgeUrl = getBridgeUrl(fallbackEnv, explicitBridgeUrl);
    }
    const apiKey = getBridgeApiKey(process.env, args['api-key']);

    if (!bridgeUrl || !/^https?:\/\//i.test(bridgeUrl)) {
        console.error(`Bridge URL not resolved. Got: ${bridgeUrl || 'empty'}`);
        process.exit(1);
    }
    if (!apiKey) {
        console.error('Missing IBKR bridge API key. Set IBKR_BRIDGE_API_KEY or pass --api-key.');
        process.exit(1);
    }

    console.log(`\n=== IBKR Max History Probe (${symbol}) ===`);
    console.log(`Bridge: ${bridgeUrl}`);

    const dailyDurations = ['30 Y', '20 Y', '15 Y', '10 Y', '7 Y', '5 Y', '3 Y', '2 Y', '1 Y'];
    const intradayDurations = ['1 Y', '6 M', '3 M', '2 M', '1 M', '2 W', '1 W', '2 D'];

    console.log('\n-- Daily Bars (1 day) --');
    for (const duration of dailyDurations) {
        const result = await probeDuration(bridgeUrl, apiKey, symbol, duration, '1 day', true);
        if (result.ok) {
            console.log(`✅ ${duration}: ${result.count} bars (${result.first} → ${result.last})`);
        } else {
            console.log(`❌ ${duration}: ${result.reason}`);
        }
    }

    console.log('\n-- Intraday Bars (1 min) --');
    for (const duration of intradayDurations) {
        const result = await probeDuration(bridgeUrl, apiKey, symbol, duration, '1 min', true);
        if (result.ok) {
            console.log(`✅ ${duration}: ${result.count} bars (${result.first} → ${result.last})`);
        } else {
            console.log(`❌ ${duration}: ${result.reason}`);
        }
    }
}

main().catch((error) => {
    console.error('Probe failed:', error);
    process.exit(1);
});
