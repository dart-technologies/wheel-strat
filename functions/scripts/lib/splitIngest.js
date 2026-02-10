const { connectDb, setForceUpdate } = require('./db');
const { parseNumber } = require('./args');

const POLYGON_SPLITS_URL = process.env.POLYGON_SPLITS_URL || 'https://api.polygon.io/v3/reference/splits';
const FETCH_TIMEOUT_MS = 30000;
const POLYGON_MAX_RETRIES = Number(process.env.POLYGON_MAX_RETRIES || 3);
const POLYGON_RETRY_MS = Number(process.env.POLYGON_RETRY_MS || 65000);

function getApiKey() {
    return process.env.POLYGON_API_KEY;
}

function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
}

function parseRatio(raw) {
    const from = Number(raw.split_from ?? raw.from ?? raw.old_shares);
    const to = Number(raw.split_to ?? raw.to ?? raw.new_shares);
    if (Number.isFinite(from) && Number.isFinite(to) && from > 0) {
        return to / from;
    }
    const ratio = Number(raw.ratio ?? raw.split_ratio);
    return Number.isFinite(ratio) ? ratio : undefined;
}

function buildUrl(base, symbol, cursor) {
    const url = new URL(base);
    if (!cursor) {
        url.searchParams.set('ticker', symbol);
        url.searchParams.set('limit', '1000');
        url.searchParams.set('sort', 'execution_date');
        url.searchParams.set('order', 'asc');
    }
    const apiKey = getApiKey();
    if (apiKey && !url.searchParams.get('apiKey')) {
        url.searchParams.set('apiKey', apiKey);
    }
    return url.toString();
}

async function fetchJson(url) {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is unavailable. Use Node 18+ or newer.');
    }
    for (let attempt = 0; attempt <= POLYGON_MAX_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: controller.signal });
            const body = await res.text();
            if (res.ok) {
                return JSON.parse(body);
            }
            if (res.status === 429 && attempt < POLYGON_MAX_RETRIES) {
                const retryAfter = Number(res.headers.get('retry-after'));
                const waitMs = Number.isFinite(retryAfter)
                    ? retryAfter * 1000
                    : POLYGON_RETRY_MS * (attempt + 1);
                console.warn(`Polygon rate limit hit. Waiting ${Math.round(waitMs / 1000)}s before retry...`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                continue;
            }
            throw new Error(`HTTP ${res.status}: ${body}`);
        } finally {
            clearTimeout(timeoutId);
        }
    }
    throw new Error('Polygon rate limit retries exhausted.');
}

async function ingestPolygonForSymbol(client, symbol, sleepMs, dryRun, logger) {
    let url = buildUrl(POLYGON_SPLITS_URL, symbol, false);
    const splits = [];

    while (url) {
        const payload = await fetchJson(url);
        const results = Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload)
                ? payload
                : [];

        for (const raw of results) {
            const date = normalizeDate(
                raw.execution_date || raw.ex_date || raw.effective_date || raw.declared_date || raw.pay_date
            );
            if (!date) continue;
            const ratio = parseRatio(raw);
            if (!ratio || !Number.isFinite(ratio) || ratio <= 0) continue;
            const factor = 1 / ratio;
            if (!Number.isFinite(factor) || factor <= 0) continue;
            splits.push({
                symbol,
                date,
                factor,
                detected_ratio: null,
                source: 'polygon',
                confidence: 1
            });
        }

        const nextUrl = payload?.next_url;
        if (nextUrl) {
            url = buildUrl(nextUrl, symbol, true);
            if (sleepMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, sleepMs));
            }
        } else {
            url = null;
        }
    }

    if (!splits.length) {
        logger.info(`No splits returned for ${symbol}.`);
        return 0;
    }

    const unique = new Map();
    for (const split of splits) {
        unique.set(split.date, split);
    }

    const rows = Array.from(unique.values());
    if (dryRun) {
        logger.info(`Dry run: would upsert ${rows.length} split factors for ${symbol}.`);
        return rows.length;
    }

    const columns = ['symbol', 'date', 'factor', 'detected_ratio', 'source', 'confidence'];
    const values = [];
    const placeholders = rows
        .map((row, rowIndex) => {
            const base = rowIndex * columns.length;
            values.push(
                row.symbol,
                row.date,
                row.factor,
                row.detected_ratio,
                row.source,
                row.confidence
            );
            const indexes = columns.map((_, colIndex) => `$${base + colIndex + 1}`);
            return `(${indexes.join(', ')})`;
        })
        .join(', ');

    const query = `
        INSERT INTO split_factors (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (symbol, date)
        DO UPDATE SET
            factor = EXCLUDED.factor,
            detected_ratio = EXCLUDED.detected_ratio,
            source = EXCLUDED.source,
            confidence = EXCLUDED.confidence,
            updated_at = NOW()
    `;

    await client.query(query, values);
    logger.info(`Inserted/updated ${rows.length} split factors for ${symbol}.`);
    return rows.length;
}

async function ingestPolygonSplits({ symbols, sleepMs, dryRun, logger }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        logger.warn('POLYGON_API_KEY missing; skipping polygon splits.');
        return;
    }
    const delay = parseNumber(sleepMs, 250);
    const client = await connectDb();
    await setForceUpdate(client, true);
    logger.warn('Force upsert enabled for split_factors.');

    try {
        for (const symbol of symbols) {
            await ingestPolygonForSymbol(client, symbol, delay, Boolean(dryRun), logger);
        }
    } finally {
        await client.end();
    }
}

async function ingestDetectedSplits({ symbols, logger }) {
    const modulePath = require('path').resolve(__dirname, '../../lib/functions/src/analysis/backtestPipeline.js');
    if (!require('fs').existsSync(modulePath)) {
        throw new Error('Missing compiled functions. Run: yarn --cwd functions build');
    }
    const pipeline = require(modulePath);
    const { ingestSplitFactorsInternal } = pipeline;
    if (typeof ingestSplitFactorsInternal !== 'function') {
        throw new Error('ingestSplitFactorsInternal export missing from compiled module.');
    }
    logger.info(`Ingesting detected split factors for: ${symbols.join(', ')}`);
    await ingestSplitFactorsInternal(symbols);
}

module.exports = {
    ingestPolygonSplits,
    ingestDetectedSplits
};
