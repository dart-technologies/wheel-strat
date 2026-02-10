#!/usr/bin/env node
const admin = require('firebase-admin');
const { loadEnv } = require('./lib/env');
const { createLogger } = require('./lib/logger');

const logger = createLogger('user-trades-backfill');

const args = process.argv.slice(2);

const parseArgs = () => {
    const options = {
        fromUsers: [],
        toUser: null,
        matchOrderRef: false,
        apply: false,
        limit: Infinity,
        audit: false,
        auditTop: 10,
        auditLimit: Infinity,
        inspectUser: null,
        inspectLimit: 200,
        inspectContracts: false,
        inspectContractsTop: 20,
        clearUserIdMissingOrderRef: false,
        deleteMissingOrderRef: false,
    };

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--audit') {
            options.audit = true;
            continue;
        }
        if (arg === '--inspect-user' && args[i + 1]) {
            options.inspectUser = String(args[i + 1]).trim();
            i += 1;
            continue;
        }
        if (arg === '--inspect-contracts') {
            options.inspectContracts = true;
            continue;
        }
        if (arg === '--clear-userid-missing-orderref') {
            options.clearUserIdMissingOrderRef = true;
            continue;
        }
        if (arg === '--delete-missing-orderref') {
            options.deleteMissingOrderRef = true;
            continue;
        }
        if (arg === '--inspect-contracts-top' && args[i + 1]) {
            options.inspectContractsTop = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg.startsWith('--inspect-contracts-top=')) {
            options.inspectContractsTop = Number(arg.split('=')[1]);
            continue;
        }
        if (arg.startsWith('--inspect-user=')) {
            options.inspectUser = String(arg.split('=')[1] || '').trim();
            continue;
        }
        if (arg === '--inspect-limit' && args[i + 1]) {
            options.inspectLimit = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg.startsWith('--inspect-limit=')) {
            options.inspectLimit = Number(arg.split('=')[1]);
            continue;
        }
        if (arg === '--audit-top' && args[i + 1]) {
            options.auditTop = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg.startsWith('--audit-top=')) {
            options.auditTop = Number(arg.split('=')[1]);
            continue;
        }
        if (arg === '--audit-limit' && args[i + 1]) {
            options.auditLimit = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg.startsWith('--audit-limit=')) {
            options.auditLimit = Number(arg.split('=')[1]);
            continue;
        }
        if (arg === '--from-user' && args[i + 1]) {
            options.fromUsers.push(String(args[i + 1]).trim());
            i += 1;
            continue;
        }
        if (arg.startsWith('--from-user=')) {
            options.fromUsers.push(String(arg.split('=')[1] || '').trim());
            continue;
        }
        if (arg === '--to-user' && args[i + 1]) {
            options.toUser = String(args[i + 1]).trim();
            i += 1;
            continue;
        }
        if (arg.startsWith('--to-user=')) {
            options.toUser = String(arg.split('=')[1] || '').trim();
            continue;
        }
        if (arg === '--match-orderref') {
            options.matchOrderRef = true;
            continue;
        }
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--limit' && args[i + 1]) {
            options.limit = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg.startsWith('--limit=')) {
            options.limit = Number(arg.split('=')[1]);
        }
    }

    options.fromUsers = options.fromUsers.filter(Boolean);
    return options;
};

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

async function main() {
    const options = parseArgs();
    const wantsCleanup = options.clearUserIdMissingOrderRef || options.deleteMissingOrderRef;
    if (!options.audit && !options.inspectUser && ((!options.toUser && !wantsCleanup) || options.fromUsers.length === 0)) {
        logger.error('Missing required args. Usage:');
        logger.error('  node functions/scripts/backfill_user_trades_userid.js --audit [--audit-top N] [--audit-limit N]');
        logger.error('  node functions/scripts/backfill_user_trades_userid.js --inspect-user <uid> [--inspect-limit N]');
        logger.error('  node functions/scripts/backfill_user_trades_userid.js --inspect-user <uid> --inspect-contracts [--inspect-contracts-top N]');
        logger.error('  node functions/scripts/backfill_user_trades_userid.js --from-user <old> --to-user <new> [--match-orderref] [--limit N] [--apply]');
        logger.error('  node functions/scripts/backfill_user_trades_userid.js --from-user <uid> --clear-userid-missing-orderref [--apply]');
        logger.error('  node functions/scripts/backfill_user_trades_userid.js --from-user <uid> --delete-missing-orderref [--apply]');
        process.exit(1);
    }

    loadEnv(['.env', '.env.local', 'functions/.env', 'functions/.env.local']);

    if (!admin.apps.length) {
        admin.initializeApp();
    }

    const db = admin.firestore();
    const collection = db.collection('user_trades');

    if (options.audit) {
        const userCounts = new Map();
        const orderRefCounts = new Map();
        let missingUserId = 0;
        let missingOrderRef = 0;
        let scanned = 0;
        let lastDoc = null;
        const pageSize = 1000;
        const maxDocs = Number.isFinite(options.auditLimit) ? options.auditLimit : Infinity;

        while (scanned < maxDocs) {
            const remaining = maxDocs - scanned;
            const limitSize = Number.isFinite(remaining) ? Math.min(pageSize, remaining) : pageSize;
            let query = collection.orderBy(admin.firestore.FieldPath.documentId()).select('userId', 'orderRef').limit(limitSize);
            if (lastDoc) query = query.startAfter(lastDoc);
            const snapshot = await query.get();
            if (snapshot.empty) break;
            snapshot.docs.forEach((doc) => {
                scanned += 1;
                const data = doc.data() || {};
                const userId = data.userId ? String(data.userId).trim() : '';
                const orderRef = data.orderRef ? String(data.orderRef).trim() : '';
                if (!userId) {
                    missingUserId += 1;
                } else {
                    userCounts.set(userId, (userCounts.get(userId) || 0) + 1);
                }
                if (!orderRef) {
                    missingOrderRef += 1;
                } else {
                    orderRefCounts.set(orderRef, (orderRefCounts.get(orderRef) || 0) + 1);
                }
            });
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            if (snapshot.size < limitSize) break;
        }

        const topEntries = (map, limit) => (
            Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([key, count]) => ({ key, count }))
        );

        logger.info(`Audit scanned ${scanned} user_trades docs.`);
        logger.info(`Missing userId: ${missingUserId}`);
        logger.info(`Missing orderRef: ${missingOrderRef}`);
        logger.info(`Top userId counts (top ${options.auditTop}):`, topEntries(userCounts, options.auditTop));
        logger.info(`Top orderRef counts (top ${options.auditTop}):`, topEntries(orderRefCounts, options.auditTop));
        return;
    }

    if (options.inspectUser) {
        const uid = options.inspectUser;
        const limit = Number.isFinite(options.inspectLimit) ? options.inspectLimit : 200;
        const snapshot = await collection
            .where('userId', '==', uid)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();

        const counts = {
            total: snapshot.size,
            optionCandidates: 0,
            secTypeOpt: 0,
            hasRight: 0,
            hasStrike: 0,
            hasExpiration: 0,
            hasLocalSymbol: 0,
            osiParseable: 0,
            hasCompleteContract: 0,
            buyCount: 0,
            sellCount: 0,
        };
        const secTypeCounts = new Map();
        const contractTrades = new Map();

        const parseOsi = (raw) => {
            if (!raw) return null;
            const compact = String(raw).replace(/\s+/g, '').toUpperCase();
            const match = compact.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/);
            if (!match) return null;
            const expiration = match[2];
            const strike = Number(match[4]) / 1000;
            return {
                symbol: match[1],
                expiration,
                right: match[3],
                strike: Number.isFinite(strike) ? strike : null
            };
        };
        const parseExpirationDate = (value) => {
            if (!value) return null;
            const raw = String(value).trim();
            if (!raw) return null;
            if (/^\\d{8}$/.test(raw)) {
                const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`;
                const date = new Date(iso);
                return Number.isNaN(date.getTime()) ? null : date;
            }
            const date = new Date(raw);
            return Number.isNaN(date.getTime()) ? null : date;
        };

        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const secType = data.secType ? String(data.secType).trim().toUpperCase() : '';
            const rightRaw = data.right ? String(data.right).trim().toUpperCase() : '';
            const right = rightRaw === 'CALL' ? 'C' : rightRaw === 'PUT' ? 'P' : rightRaw;
            const strike = typeof data.strike === 'number' ? data.strike : Number(data.strike);
            const expiration = data.expiration ? String(data.expiration).trim() : '';
            const localSymbol = data.localSymbol ? String(data.localSymbol).trim() : '';
            const osi = parseOsi(localSymbol);

            if (secType) {
                secTypeCounts.set(secType, (secTypeCounts.get(secType) || 0) + 1);
            }
            if (secType === 'OPT') counts.secTypeOpt += 1;
            if (right) counts.hasRight += 1;
            if (Number.isFinite(strike) && strike > 0) counts.hasStrike += 1;
            if (expiration) counts.hasExpiration += 1;
            if (localSymbol) counts.hasLocalSymbol += 1;
            if (osi) counts.osiParseable += 1;

            const contractSymbol = data.symbol ? String(data.symbol).trim().toUpperCase() : osi?.symbol;
            const contractRight = right || osi?.right;
            const contractStrike = Number.isFinite(strike) && strike > 0 ? strike : osi?.strike;
            const contractExp = expiration || osi?.expiration;

            const isOptionCandidate = secType === 'OPT' || contractRight || contractStrike || contractExp || localSymbol;
            if (isOptionCandidate) counts.optionCandidates += 1;

            const hasCompleteContract = Boolean(contractSymbol && contractRight && contractStrike && contractExp);
            if (hasCompleteContract) {
                counts.hasCompleteContract += 1;
                const key = `${contractSymbol}|${contractRight}|${contractStrike}|${contractExp}`;
                const entry = contractTrades.get(key) || {
                    symbol: contractSymbol,
                    right: contractRight,
                    strike: contractStrike,
                    expiration: contractExp,
                    buys: 0,
                    sells: 0,
                    lastDate: null
                };
                const side = String(data.type || data.side || '').trim().toUpperCase();
                if (side === 'BUY' || side === 'BOT') {
                    entry.buys += 1;
                    counts.buyCount += 1;
                } else if (side === 'SELL' || side === 'SLD') {
                    entry.sells += 1;
                    counts.sellCount += 1;
                }
                const tradeDate = data.date ? new Date(String(data.date)) : null;
                if (tradeDate && !Number.isNaN(tradeDate.getTime())) {
                    if (!entry.lastDate || tradeDate.getTime() > entry.lastDate.getTime()) {
                        entry.lastDate = tradeDate;
                    }
                }
                contractTrades.set(key, entry);
            }
        });

        const closedContracts = Array.from(contractTrades.values())
            .filter((entry) => entry.buys > 0 && entry.sells > 0).length;
        const expiredOpenContracts = Array.from(contractTrades.values())
            .filter((entry) => entry.sells > 0 && entry.buys === 0)
            .filter((entry) => {
                const expDate = parseExpirationDate(entry.expiration);
                return expDate ? expDate.getTime() <= Date.now() : false;
            }).length;

        const topSecTypes = Array.from(secTypeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key, count]) => ({ key, count }));

        logger.info(`Inspect user: ${uid}`);
        logger.info('Counts:', { ...counts, closedContracts, expiredOpenContracts });
        logger.info('Top secType values:', topSecTypes);
        if (options.inspectContracts) {
            const contractSummary = Array.from(contractTrades.values())
                .map((entry) => {
                    const expDate = parseExpirationDate(entry.expiration);
                    const expired = expDate ? expDate.getTime() <= Date.now() : false;
                    return {
                        symbol: entry.symbol,
                        right: entry.right,
                        strike: entry.strike,
                        expiration: entry.expiration,
                        expired,
                        buys: entry.buys,
                        sells: entry.sells,
                        lastDate: entry.lastDate ? entry.lastDate.toISOString().split('T')[0] : null
                    };
                })
                .sort((a, b) => {
                    if (b.sells !== a.sells) return b.sells - a.sells;
                    if (b.buys !== a.buys) return b.buys - a.buys;
                    return String(b.expiration).localeCompare(String(a.expiration));
                })
                .slice(0, options.inspectContractsTop);
            logger.info(`Top contract stats (top ${options.inspectContractsTop}):`, contractSummary);
        }
        logger.info('Sample docs:', snapshot.docs.slice(0, 5).map((doc) => {
            const data = doc.data() || {};
            return {
                id: doc.id,
                symbol: data.symbol || null,
                type: data.type || null,
                side: data.side || null,
                secType: data.secType || null,
                right: data.right || null,
                strike: data.strike || null,
                expiration: data.expiration || null,
                localSymbol: data.localSymbol || null,
                quantity: data.quantity || null,
                price: data.price || null,
                total: data.total || null,
                date: data.date || null,
            };
        }));
        return;
    }
    const docMap = new Map();

    const chunks = chunkArray(options.fromUsers, 10);
    for (const chunk of chunks) {
        const snapshot = await collection.where('userId', 'in', chunk).get();
        snapshot.forEach((doc) => {
            docMap.set(doc.id, doc);
        });
    }

    if (options.matchOrderRef) {
        for (const chunk of chunks) {
            const snapshot = await collection.where('orderRef', 'in', chunk).get();
            snapshot.forEach((doc) => {
                docMap.set(doc.id, doc);
            });
        }
    }

    let toUpdate = [];
    docMap.forEach((doc) => {
        const data = doc.data() || {};
        const userId = data.userId ? String(data.userId).trim() : '';
        const orderRef = data.orderRef ? String(data.orderRef).trim() : '';
        const matchesUser = options.fromUsers.includes(userId);
        const matchesOrderRef = options.matchOrderRef && options.fromUsers.includes(orderRef);
        if (!matchesUser && !matchesOrderRef) return;
        if (wantsCleanup) {
            if (orderRef) return;
        }
        if (userId === options.toUser) return;
        toUpdate.push({ doc, userId, orderRef });
    });

    if (Number.isFinite(options.limit)) {
        toUpdate = toUpdate.slice(0, options.limit);
    }

    logger.info(`Matched ${docMap.size} docs. Updating ${toUpdate.length} to userId=${options.toUser}.`);
    if (!options.apply) {
        const sample = toUpdate.slice(0, 5).map((item) => ({
            id: item.doc.id,
            userId: item.userId || null,
            orderRef: item.orderRef || null
        }));
        logger.info('Dry run sample:', sample);
        logger.warn('Dry run only. Re-run with --apply to commit changes.');
        return;
    }

    let batch = db.batch();
    let batchCount = 0;
    let updated = 0;
    const maxBatch = 400;

    for (const entry of toUpdate) {
        if (options.deleteMissingOrderRef) {
            batch.delete(entry.doc.ref);
        } else if (options.clearUserIdMissingOrderRef) {
            batch.update(entry.doc.ref, { userId: admin.firestore.FieldValue.delete() });
        } else {
            batch.update(entry.doc.ref, { userId: options.toUser });
        }
        batchCount += 1;
        updated += 1;
        if (batchCount >= maxBatch) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    if (options.deleteMissingOrderRef) {
        logger.info(`Cleanup complete. Deleted ${updated} docs.`);
    } else if (options.clearUserIdMissingOrderRef) {
        logger.info(`Cleanup complete. Cleared userId for ${updated} docs.`);
    } else {
        logger.info(`Backfill complete. Updated ${updated} docs.`);
    }
}

main().catch((error) => {
    logger.error('Backfill failed:', error);
    process.exit(1);
});
