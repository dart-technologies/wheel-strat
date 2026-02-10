import { store } from '@/data/store';
import type { Row } from 'tinybase';
import { Trade, TradeInput } from '@wheel-strat/shared';

export type { TradeInput };

type OptionMeta = {
    secType?: string;
    right?: string;
    strike?: number;
    expiration?: string;
    multiplier?: number;
    localSymbol?: string;
    conId?: number;
};

const readString = (value?: unknown) => {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return undefined;
};

const readNumber = (value?: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const readPositiveNumber = (value?: unknown) => {
    const parsed = readNumber(value);
    return typeof parsed === 'number' && parsed > 0 ? parsed : undefined;
};

const getRawField = (raw: Record<string, unknown> | undefined, key: string) => {
    return raw && Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : undefined;
};

const extractOptionMeta = (trade: Trade): OptionMeta | null => {
    const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, unknown> : undefined;
    const secType = readString(trade.secType ?? getRawField(raw, 'secType'));
    const right = readString(trade.right ?? getRawField(raw, 'right'));
    const strike = readPositiveNumber(trade.strike ?? getRawField(raw, 'strike'));
    const expiration = readString(
        trade.expiration
        ?? getRawField(raw, 'expiration')
        ?? getRawField(raw, 'lastTradeDateOrContractMonth')
    );
    const multiplier = readNumber(trade.multiplier ?? getRawField(raw, 'multiplier'));
    const localSymbol = readString(trade.localSymbol ?? getRawField(raw, 'localSymbol'));
    const conId = readNumber(trade.conId ?? getRawField(raw, 'conId'));

    const looksLikeOption = secType?.toUpperCase() === 'OPT'
        || Boolean(right)
        || Number.isFinite(strike ?? NaN)
        || Boolean(expiration);

    if (!looksLikeOption) return null;

    return {
        secType,
        right,
        strike,
        expiration,
        multiplier,
        localSymbol,
        conId
    };
};

const sanitizeTradeRow = (trade: Trade): Row => {
    const { raw, ...rest } = trade;
    return rest as unknown as Row;
};

export function addTrade({ symbol, quantity, price, type = 'BUY' }: TradeInput): Trade | null {
    if (!symbol || !quantity || !price) return null;

    const sym = symbol.toUpperCase();
    const date = new Date().toISOString().split('T')[0];
    const tradeId = `t_${Date.now()}`;

    const trade: Trade = {
        id: tradeId,
        symbol: sym,
        type,
        quantity,
        price,
        date,
        total: quantity * price
    };

    store.setRow('trades', tradeId, sanitizeTradeRow(trade));
    updatePositionsFromTrade(trade);

    return trade;
}

export function syncTradeFromBridge(trade: Trade, options?: { updatePositions?: boolean }) {
    const raw = trade.raw && typeof trade.raw === 'object' ? trade.raw as Record<string, unknown> : undefined;
    const orderRef = readString(getRawField(raw, 'orderRef'));
    if (store.hasRow('trades', trade.id)) {
        if (orderRef) {
            const existing = store.getRow('trades', trade.id) as Row;
            if (!existing.orderRef) {
                store.setRow('trades', trade.id, { ...existing, orderRef });
            }
        }
        return; // Skip duplicates
    }

    const optionMeta = extractOptionMeta(trade);
    const resolvedQuantity = readNumber(trade.quantity ?? getRawField(raw, 'shares') ?? getRawField(raw, 'cumQty'));
    const resolvedMultiplier = readNumber(trade.multiplier ?? getRawField(raw, 'multiplier'))
        ?? (optionMeta ? 100 : 1);
    const resolvedTradePrice = readNumber(trade.price);
    const resolvedPrice = (resolvedTradePrice && resolvedTradePrice !== 0)
        ? resolvedTradePrice
        : readNumber(getRawField(raw, 'avgPrice') ?? getRawField(raw, 'price'));
    const resolvedTotal = readNumber(trade.total);
    const computedTotal = (resolvedPrice && resolvedQuantity)
        ? resolvedPrice * resolvedQuantity * resolvedMultiplier
        : undefined;
    const normalizedTrade = optionMeta
        ? {
            ...trade,
            ...optionMeta,
            orderRef,
            quantity: resolvedQuantity ?? trade.quantity,
            price: resolvedPrice ?? trade.price,
            total: (computedTotal && computedTotal !== 0) ? computedTotal : (resolvedTotal ?? trade.total),
            multiplier: resolvedMultiplier ?? trade.multiplier
        }
        : {
            ...trade,
            orderRef,
            quantity: resolvedQuantity ?? trade.quantity,
            price: resolvedPrice ?? trade.price,
            total: (computedTotal && computedTotal !== 0) ? computedTotal : (resolvedTotal ?? trade.total)
        };

    store.setRow('trades', trade.id, sanitizeTradeRow(normalizedTrade));
    
    // Track persistent sync time
    store.setCell('syncMetadata', 'main', 'lastTradesSync', new Date().toISOString());

    if (options?.updatePositions !== false) {
        updatePositionsFromTrade(normalizedTrade);
    }
}

function updatePositionsFromTrade(trade: Trade) {
    const optionMeta = extractOptionMeta(trade);
    if (optionMeta) {
        updateOptionPosition(trade, optionMeta);
        return;
    }

    updateStockPosition(trade);
}

function updateStockPosition(trade: Trade) {
    const sym = trade.symbol.toUpperCase();
    const existingPos = store.getRow('positions', sym);

    if (trade.type !== 'BUY' && trade.type !== 'SELL') {
        return;
    }

    // Simple position logic: BUY adds, SELL removes
    // This is a naive implementation; real accounting needs FIFO/LIFO handling
    const direction = trade.type === 'BUY' ? 1 : -1;
    const signedQty = trade.quantity * direction;

    if (Object.keys(existingPos).length > 0) {
        const oldQty = (existingPos.quantity as number) || 0;
        const oldAvg = (existingPos.averageCost as number) || 0;

        let newQty = oldQty + signedQty;
        let newAvg = oldAvg;

        if (direction > 0) {
            // Weighted average for buys
            newAvg = ((oldQty * oldAvg) + (trade.quantity * trade.price)) / newQty;
        }
        // For sells, average cost doesn't change, just realized P&L (which we aren't tracking in position row yet)

        if (newQty <= 0) {
            store.delRow('positions', sym);
        } else {
            store.setRow('positions', sym, {
                ...existingPos,
                quantity: newQty,
                averageCost: newAvg,
            });
        }
    } else if (direction > 0) {
        store.setRow('positions', sym, {
            symbol: sym,
            quantity: trade.quantity,
            averageCost: trade.price,
            currentPrice: trade.price,
        });
    }
}

function updateOptionPosition(trade: Trade, optionMeta: OptionMeta) {
    const sym = trade.symbol.toUpperCase();
    const optionId = optionMeta.conId
        ? String(optionMeta.conId)
        : optionMeta.localSymbol
            ? optionMeta.localSymbol
            : `${sym}-${optionMeta.right || 'X'}-${optionMeta.strike || 0}-${optionMeta.expiration || 'na'}`;

    const existing = store.getRow('optionPositions', optionId);

    const direction = trade.type === 'BUY' ? 1 : -1;
    const signedQty = trade.quantity * direction;
    const multiplier = optionMeta.multiplier ?? 100;

    if (Object.keys(existing).length > 0) {
        const oldQty = (existing.quantity as number) || 0;
        const oldAvg = (existing.averageCost as number) || 0;
        const newQty = oldQty + signedQty;

        if (newQty === 0) {
            store.delRow('optionPositions', optionId);
            return;
        }

        const sameSign = Math.sign(oldQty) === Math.sign(newQty);
        const absOld = Math.abs(oldQty);
        const absNew = Math.abs(newQty);
        const absDelta = Math.abs(signedQty);

        const newAvg = sameSign
            ? ((absOld * oldAvg) + (absDelta * trade.price)) / absNew
            : trade.price;

        store.setRow('optionPositions', optionId, {
            ...existing,
            symbol: sym,
            quantity: newQty,
            averageCost: newAvg,
            currentPrice: trade.price,
            marketValue: trade.price * newQty * multiplier,
            ...optionMeta
        });
        return;
    }

    store.setRow('optionPositions', optionId, {
        symbol: sym,
        quantity: signedQty,
        averageCost: trade.price,
        currentPrice: trade.price,
        marketValue: trade.price * signedQty * multiplier,
        ...optionMeta
    });
}
