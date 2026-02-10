#!/usr/bin/env node
const { loadEnv } = require('../lib/env');
const { getBridgeApiKey, getBridgeProfile, getBridgeUrl } = require('../lib/ibkrBridgeConfig');

const args = process.argv.slice(2);

const getArg = (flag, fallback) => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
        return args[idx + 1];
    }
    const direct = args.find((arg) => arg.startsWith(`${flag}=`));
    if (direct) return direct.split('=')[1];
    return fallback;
};

const symbol = String(getArg('--symbol', args[0] || 'AAPL')).toUpperCase();
const minDte = Number(getArg('--min-dte', '7'));
const maxDte = Number(getArg('--max-dte', '21'));
const strikeCount = Number(getArg('--strike-count', '6'));
const explicitBridgeUrl = getArg('--bridge-url');
const explicitApiKey = getArg('--api-key');
const callFunction = args.includes('--refresh') || args.includes('--call-function');
const explicitFunctionsUrl = getArg('--functions-url');
const dteWindow = getArg('--dte-window', 'three_weeks');
const targetWinProb = Number(getArg('--target-win-prob', '70'));

loadEnv({ files: ['.env', '.env.local', 'functions/.env', 'functions/.env.local'] });

const bridgeUrl = getBridgeUrl(process.env, explicitBridgeUrl);
const bridgeApiKey = getBridgeApiKey(process.env, explicitApiKey);
const profile = getBridgeProfile(process.env);

const resolveFunctionsBaseUrl = () => {
    if (explicitFunctionsUrl) return explicitFunctionsUrl;
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID
        || process.env.EXPO_PUBLIC_PROJECT_ID
        || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) return null;
    const useEmulator = String(process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR || '').toLowerCase() === 'true';
    const emulatorPort = process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || '5001';
    if (useEmulator) {
        return `http://localhost:${emulatorPort}/${projectId}/us-central1`;
    }
    return `https://us-central1-${projectId}.cloudfunctions.net`;
};

const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
};
if (bridgeApiKey) headers['X-API-KEY'] = bridgeApiKey;

const fetchJson = async (path, options = {}) => {
    const res = await fetch(`${bridgeUrl}${path}`, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    return { res, json, text };
};

const toNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toDate = (yyyymmdd) => {
    if (!yyyymmdd) return null;
    const raw = String(yyyymmdd).trim();
    if (!/^\d{8}$/.test(raw)) return null;
    return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`);
};

const daysToExpiration = (yyyymmdd) => {
    const date = toDate(yyyymmdd);
    if (!date) return null;
    const diff = date.getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

const normalizePremium = (quote) => {
    if (!quote) return { premium: undefined, source: null };
    const bid = toNumber(quote.bid);
    const ask = toNumber(quote.ask);
    const last = toNumber(quote.last);
    const close = toNumber(quote.close);
    const model = toNumber(quote.modelOptPrice ?? quote.modelPrice);
    if (typeof bid === 'number' && typeof ask === 'number' && bid > 0 && ask > 0) {
        return { premium: (bid + ask) / 2, source: 'mid' };
    }
    if (typeof bid === 'number' && bid > 0) return { premium: bid, source: 'bid' };
    if (typeof ask === 'number' && ask > 0) return { premium: ask, source: 'ask' };
    if (typeof last === 'number' && last > 0) return { premium: last, source: 'last' };
    if (typeof close === 'number' && close > 0) return { premium: close, source: 'close' };
    if (typeof model === 'number' && model > 0) return { premium: model, source: 'model' };
    return { premium: undefined, source: null };
};

const pickStrikes = (strikes, price, direction) => {
    const filtered = strikes
        .filter((strike) => Number.isFinite(strike))
        .sort((a, b) => a - b)
        .filter((strike) => {
            if (direction === 'C') return strike >= price;
            if (direction === 'P') return strike <= price;
            return true;
        });
    if (!filtered.length) return [];
    return filtered.slice(0, strikeCount);
};

const diagnose = async () => {
    console.log('Live Options Diagnosis');
    console.log(`Symbol: ${symbol}`);
    console.log(`Profile: ${profile}`);
    console.log(`Bridge URL: ${bridgeUrl}`);
    console.log(`API Key: ${bridgeApiKey ? 'set' : 'missing'}`);
    console.log(`DTE window: ${minDte}-${maxDte} days`);
    console.log('');

    const health = await fetchJson('/health');
    console.log('Health:', health.res.status, health.json || health.text || 'no response');

    const market = await fetchJson(`/market-data/${symbol}`);
    if (!market.res.ok) {
        console.error('Market data fetch failed:', market.res.status, market.text);
        return;
    }
    const price = toNumber(market.json?.last ?? market.json?.bid ?? market.json?.close);
    console.log('Market data:', {
        price,
        bid: market.json?.bid,
        ask: market.json?.ask,
        last: market.json?.last,
        close: market.json?.close
    });
    if (!price) {
        console.error('Missing current price; yields cannot be computed.');
        return;
    }

    const chain = await fetchJson(`/option-chain/${symbol}`);
    if (!chain.res.ok) {
        console.error('Option chain fetch failed:', chain.res.status, chain.text);
        return;
    }
    const expirations = Array.isArray(chain.json?.expirations) ? chain.json.expirations : [];
    const strikes = Array.isArray(chain.json?.strikes) ? chain.json.strikes.map(toNumber).filter(Boolean) : [];
    if (!expirations.length || !strikes.length) {
        console.error('No expirations or strikes returned; yields cannot be computed.');
        return;
    }

    const withDte = expirations.map((exp) => ({ exp, dte: daysToExpiration(exp) }))
        .filter((item) => typeof item.dte === 'number');
    const target = withDte.find((item) => item.dte >= minDte && item.dte <= maxDte) || withDte[0];
    if (!target) {
        console.error('No usable expiration found.');
        return;
    }

    console.log('Selected expiration:', target.exp, `(${target.dte}d)`);

    const callStrikes = pickStrikes(strikes, price, 'C');
    const putStrikes = pickStrikes(strikes.slice().reverse(), price, 'P');

    const contracts = [
        ...callStrikes.map((strike) => ({ symbol, strike, expiration: target.exp, right: 'C' })),
        ...putStrikes.map((strike) => ({ symbol, strike, expiration: target.exp, right: 'P' }))
    ];

    if (contracts.length === 0) {
        console.error('No candidate strikes found.');
        return;
    }

    console.log(`Requesting ${contracts.length} option quotes...`);
    const quoteResults = [];
    for (const contract of contracts) {
        const quote = await fetchJson('/option-quote', {
            method: 'POST',
            body: JSON.stringify(contract)
        });
        quoteResults.push({ contract, status: quote.res.status, payload: quote.json });
    }

    const summary = quoteResults.map(({ contract, status, payload }) => {
        const premiumInfo = normalizePremium(payload);
        return {
            ...contract,
            status,
            premium: premiumInfo.premium,
            source: premiumInfo.source,
            delta: payload?.delta,
            theta: payload?.theta,
            bid: payload?.bid,
            ask: payload?.ask,
            last: payload?.last,
        };
    });

    const ccCandidates = summary.filter((item) => item.right === 'C');
    const cspCandidates = summary.filter((item) => item.right === 'P');

    const validPremium = (item) => typeof item.premium === 'number' && item.premium >= 0.05;
    const ccValid = ccCandidates.filter(validPremium);
    const cspValid = cspCandidates.filter(validPremium);

    console.log('');
    console.log('Call candidates:', ccCandidates);
    console.log('Put candidates:', cspCandidates);
    console.log('');
    console.log(`Valid CC premiums >= 0.05: ${ccValid.length}`);
    console.log(`Valid CSP premiums >= 0.05: ${cspValid.length}`);

    if (ccValid.length === 0) {
        console.warn('No viable CC premium found; yields will be blank.');
    }
    if (cspValid.length === 0) {
        console.warn('No viable CSP premium found; yields will be blank.');
    }

    if (callFunction) {
        const baseUrl = resolveFunctionsBaseUrl();
        if (!baseUrl) {
            console.warn('No functions base URL found. Provide --functions-url or set EXPO_PUBLIC_FIREBASE_PROJECT_ID.');
            return;
        }
        const endpoint = baseUrl.endsWith('/refreshLiveOptions')
            ? baseUrl
            : `${baseUrl}/refreshLiveOptions`;
        console.log('');
        console.log(`Calling refreshLiveOptions: ${endpoint}`);
        const payload = {
            data: {
                symbols: [symbol],
                targetWinProb,
                dteWindow,
                debug: true
            }
        };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const raw = await response.text();
        let parsed = null;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        if (!response.ok) {
            console.error('refreshLiveOptions failed:', response.status, raw);
            return;
        }
        const resultPayload = parsed?.result ?? parsed?.data ?? parsed;
        const result = Array.isArray(resultPayload?.results) ? resultPayload.results[0] : resultPayload;
        console.log('refreshLiveOptions result:', result);
        if (result?.diagnostics) {
            console.log('Diagnostics:', result.diagnostics);
        }
    }
};

diagnose().catch((err) => {
    console.error('Diagnosis failed:', err);
    process.exit(1);
});
