import { IBKRExecution, IBKROrder } from './ibkrSyncTypes';
import { normalizeExpiration, toNumber } from './ibkrSyncUtils';

export function formatExpirationDashed(value?: string) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const digits = normalizeExpiration(trimmed);
    if (digits) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
    return null;
}

export function normalizeRight(value?: string) {
    if (!value) return null;
    const upper = value.toUpperCase();
    if (upper === 'C' || upper === 'P') return upper;
    return null;
}

export function isOptionExecution(exec: IBKRExecution) {
    const secType = exec.secType ? exec.secType.toUpperCase() : '';
    if (secType === 'OPT') return true;
    if (exec.right) return true;
    if (typeof exec.strike === 'number' && exec.strike > 0) return true;
    return Boolean(exec.expiration);
}

export function buildOptionKey(exec: IBKRExecution) {
    const symbol = exec.symbol?.toUpperCase();
    const right = normalizeRight(exec.right);
    const strike = toNumber(exec.strike);
    const expiration = normalizeExpiration(exec.expiration);
    if (!symbol || !right || typeof strike !== 'number' || !Number.isFinite(strike) || strike <= 0 || !expiration) {
        return null;
    }
    return `${symbol}_${right}_${strike}_${expiration}`;
}

export function normalizeOrder(raw: any): IBKROrder | null {
    if (!raw || typeof raw !== 'object') return null;
    const symbol = raw.symbol ? String(raw.symbol).trim() : '';
    if (!symbol) return null;
    const action = raw.action === 'SELL' ? 'SELL' : raw.action === 'BUY' ? 'BUY' : undefined;
    return {
        orderId: toNumber(raw.orderId),
        permId: toNumber(raw.permId),
        status: raw.status ? String(raw.status) : undefined,
        action,
        totalQuantity: toNumber(raw.totalQuantity),
        remaining: toNumber(raw.remaining),
        filled: toNumber(raw.filled),
        avgFillPrice: toNumber(raw.avgFillPrice),
        orderType: raw.orderType ? String(raw.orderType) : undefined,
        lmtPrice: toNumber(raw.lmtPrice),
        auxPrice: toNumber(raw.auxPrice),
        initMarginChange: toNumber(raw.initMarginChange),
        tif: raw.tif ? String(raw.tif) : undefined,
        account: raw.account ? String(raw.account) : undefined,
        orderRef: raw.orderRef ? String(raw.orderRef) : undefined,
        symbol,
        secType: raw.secType ? String(raw.secType) : undefined,
        right: raw.right ? String(raw.right) : undefined,
        strike: toNumber(raw.strike),
        expiration: raw.expiration ? String(raw.expiration) : undefined,
        localSymbol: raw.localSymbol ? String(raw.localSymbol) : undefined,
        conId: toNumber(raw.conId),
        multiplier: toNumber(raw.multiplier),
        currency: raw.currency ? String(raw.currency) : undefined,
        exchange: raw.exchange ? String(raw.exchange) : undefined
    };
}
