import type { Row } from 'tinybase';
import { Trade } from '@wheel-strat/shared';

type StoreRef = typeof import('@/data/store').store;

let cachedStore: StoreRef | null = null;

const getStore = (): StoreRef => {
    if (!cachedStore) {
        cachedStore = require('@/data/store').store;
    }
    return cachedStore as StoreRef;
};

const sanitizeOrderRow = (order: Trade): Row => {
    const { raw, ...rest } = order;
    return rest as unknown as Row;
};

const INTENT_TTL_MS = 15 * 60 * 1000;

const normalizeSymbol = (value?: unknown) => (
    typeof value === 'string' ? value.trim().toUpperCase() : ''
);

const normalizeExpiration = (value?: unknown) => {
    if (typeof value !== 'string') return '';
    return value.replace(/[^0-9]/g, '').slice(0, 8);
};

const resolveIntentRight = (row: Row) => {
    const right = typeof row.right === 'string' ? row.right.toUpperCase() : '';
    if (right) return right;
    const type = typeof row.type === 'string' ? row.type.toUpperCase() : '';
    if (type === 'CC') return 'C';
    if (type === 'CSP') return 'P';
    return '';
};

const isPendingIntent = (row: Row) => {
    const status = typeof row.status === 'string' ? row.status : '';
    return status === 'PendingIntent';
};

const isIntentMatch = (intent: Row, order: Trade) => {
    const intentSymbol = normalizeSymbol(intent.symbol);
    const orderSymbol = normalizeSymbol(order.symbol);
    if (!intentSymbol || intentSymbol !== orderSymbol) return false;

    const intentRight = resolveIntentRight(intent);
    const orderRight = typeof order.right === 'string' ? order.right.toUpperCase() : '';
    if (intentRight && orderRight && intentRight !== orderRight) return false;

    const intentStrike = Number(intent.strike);
    const orderStrike = Number(order.strike);
    if (Number.isFinite(intentStrike) && Number.isFinite(orderStrike)) {
        if (Math.abs(intentStrike - orderStrike) > 0.01) return false;
    }

    const intentExp = normalizeExpiration(intent.expiration);
    const orderExp = normalizeExpiration(order.expiration);
    if (intentExp && orderExp && intentExp !== orderExp) return false;

    return true;
};

export function createOrderIntent(input: {
    symbol: string;
    type: Trade['type'];
    quantity: number;
    price?: number;
    strike?: number;
    expiration?: string;
    right?: string;
}) {
    const id = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const price = typeof input.price === 'number' && Number.isFinite(input.price) ? input.price : 0;
    const row: Row = {
        id,
        symbol: input.symbol,
        type: input.type,
        quantity: input.quantity,
        price,
        date: new Date().toISOString().split('T')[0],
        total: price * input.quantity,
        status: 'PendingIntent',
        orderStatus: 'PendingIntent',
        updatedAt: new Date().toISOString()
    };
    if (typeof input.strike === 'number') {
        row.strike = input.strike;
    }
    if (typeof input.expiration === 'string') {
        row.expiration = input.expiration;
    }
    if (typeof input.right === 'string') {
        row.right = input.right;
    }
    getStore().setRow('orders', id, row);
    return id;
}

export function updateOrderIntent(intentId: string, update: Partial<Row>) {
    if (!intentId) return;
    const store = getStore();
    store.setRow('orders', intentId, {
        ...store.getRow('orders', intentId),
        ...update,
        updatedAt: new Date().toISOString()
    });
}

export function removeOrderIntent(intentId: string) {
    if (!intentId) return;
    getStore().delRow('orders', intentId);
}

export function getPendingOrderIntentIds() {
    const rows = getStore().getTable('orders');
    return Object.entries(rows)
        .filter(([, row]) => row && isPendingIntent(row as Row))
        .map(([id]) => id);
}

export function syncOrdersFromFirestore(orders: Trade[]) {
    const store = getStore();
    const nextIds = new Set<string>();
    const pendingIntents = new Map<string, Row>();
    const now = Date.now();

    store.getRowIds('orders').forEach((id: string) => {
        const row = store.getRow('orders', id) as Row;
        if (row && isPendingIntent(row)) {
            pendingIntents.set(id, row);
        }
    });

    orders.forEach((order) => {
        if (!order?.id) return;
        nextIds.add(order.id);
        store.setRow('orders', order.id, sanitizeOrderRow(order));
    });

    pendingIntents.forEach((intent, id) => {
        const matched = orders.some((order) => isIntentMatch(intent, order));
        if (matched) {
            store.delRow('orders', id);
            pendingIntents.delete(id);
        }
    });

    const existingIds = store.getRowIds('orders');
    existingIds.forEach((id: string) => {
        if (nextIds.has(id)) return;
        const row = store.getRow('orders', id) as Row;
        if (row && isPendingIntent(row)) {
            const updatedAt = Date.parse(String(row.updatedAt || ''));
            if (Number.isFinite(updatedAt) && (now - updatedAt) < INTENT_TTL_MS) {
                return;
            }
        }
        store.delRow('orders', id);
    });

    // Track persistent sync time
    store.setCell('syncMetadata', 'main', 'lastTradesSync', new Date().toISOString());
}
