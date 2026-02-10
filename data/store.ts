import { createStore, createQueries } from 'tinybase';
import type { Store, Row, Cell } from 'tinybase';
import { createExpoSqlitePersister } from 'tinybase/persisters/persister-expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { SCHEMAS } from '@wheel-strat/shared';

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);

// Initialize the SQLite database (skip in tests)
const db = isTestEnv ? null : SQLite.openDatabaseSync('wheel-strat.db');

// Create the TinyBase store
export const store = createStore();

// Create the queries module
export const queries = createQueries(store);

const SCHEMA_VERSION = 3;
const SCHEMA_VERSION_KEY = 'schemaVersion';
const DEFAULT_ROW_IDS: Record<string, string> = {
    portfolio: 'main',
    appSettings: 'main',
    syncMetadata: 'main',
};

type TableSchema = Record<string, { default?: unknown }>;
const TABLE_SCHEMAS: Record<string, TableSchema> = SCHEMAS as Record<string, TableSchema>;

const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

const getStoredSchemaVersion = (storeInstance: Store) => {
    const raw = storeInstance.getValue(SCHEMA_VERSION_KEY);
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
};

const setStoredSchemaVersion = (storeInstance: Store, version: number) => {
    storeInstance.setValue(SCHEMA_VERSION_KEY, version);
};

const buildDefaultRow = (schema: TableSchema): Row => {
    const row: Row = {};
    Object.entries(schema).forEach(([cellId, cellSchema]) => {
        if (hasOwn(cellSchema, 'default')) {
            row[cellId] = cellSchema.default as Cell;
        }
    });
    return row;
};

const applyDefaultsForRow = (
    storeInstance: Store,
    tableId: string,
    rowId: string,
    row: Row,
    schema: TableSchema
) => {
    Object.entries(schema).forEach(([cellId, cellSchema]) => {
        if (!hasOwn(cellSchema, 'default')) return;
        if (!hasOwn(row, cellId)) {
            storeInstance.setCell(tableId, rowId, cellId, cellSchema.default as Cell);
        }
    });
};

const ensureDefaultRows = (storeInstance: Store) => {
    Object.entries(DEFAULT_ROW_IDS).forEach(([tableId, rowId]) => {
        const schema = TABLE_SCHEMAS[tableId];
        if (!schema) return;
        if (!storeInstance.hasRow(tableId, rowId)) {
            const defaults = buildDefaultRow(schema);
            if (Object.keys(defaults).length > 0) {
                storeInstance.setRow(tableId, rowId, defaults);
            }
            return;
        }
            const row = storeInstance.getRow(tableId, rowId) as Row;
            applyDefaultsForRow(storeInstance, tableId, rowId, row, schema);
    });
};

const applySchemaDefaults = (storeInstance: Store) => {
    Object.entries(TABLE_SCHEMAS).forEach(([tableId, schema]) => {
        const table = storeInstance.getTable(tableId);
        if (!table || Object.keys(table).length === 0) return;
        Object.entries(table).forEach(([rowId, row]) => {
            applyDefaultsForRow(storeInstance, tableId, rowId, row as Row, schema);
        });
    });
};

const migrateStore = (storeInstance: Store) => {
    const currentVersion = getStoredSchemaVersion(storeInstance);
    if (currentVersion >= SCHEMA_VERSION) return;

    const hasTables = storeInstance.getTableIds().length > 0;
    if (!hasTables) {
        setStoredSchemaVersion(storeInstance, SCHEMA_VERSION);
        return;
    }

    for (let nextVersion = currentVersion + 1; nextVersion <= SCHEMA_VERSION; nextVersion++) {
        if (nextVersion === 1) {
            ensureDefaultRows(storeInstance);
            applySchemaDefaults(storeInstance);
        }
        if (nextVersion === 2) {
            ensureDefaultRows(storeInstance);
            applySchemaDefaults(storeInstance);
        }
        if (nextVersion === 3) {
            ensureDefaultRows(storeInstance);
            applySchemaDefaults(storeInstance);
        }
    }

    setStoredSchemaVersion(storeInstance, SCHEMA_VERSION);
};

// Define persistent queries for efficient sorting
// 1. Positions sorting
queries.setQueryDefinition('positions_by_value', 'positions', ({ select }) => {
    select('symbol');
    select('quantity');
    select('averageCost');
    select('currentPrice');
    select('closePrice');
    select('costBasis');
    select('marketValue');
    select('dailyPnl');
    select('dailyPnlPct');
    select('ivRank');
    select('rsi');
    select('beta');
    select('delta');
    select('theta');
    select('gamma');
    select('vega');
    select('companyName');
    select('cspYield');
    select('ccYield');
    select('cspPremium');
    select('ccPremium');
    select('cspStrike');
    select('ccStrike');
    select('cspPremiumSource');
    select('ccPremiumSource');

    // Select Market Value as a calculated cell for sorting
    select((get) => {
        const qty = Number(get('quantity') || 0);
        const currentPrice = Number(get('currentPrice'));
        const averageCost = Number(get('averageCost'));
        const price = Number.isFinite(currentPrice) && currentPrice > 0
            ? currentPrice
            : (Number.isFinite(averageCost) ? averageCost : 0);
        return qty * price;
    }).as('marketValue');
});

queries.setQueryDefinition('positions_by_csp_yield', 'positions', ({ select }) => {
    select('symbol');
    select('quantity');
    select('averageCost');
    select('currentPrice');
    select('closePrice');
    select('costBasis');
    select('marketValue');
    select('dailyPnl');
    select('dailyPnlPct');
    select('ivRank');
    select('rsi');
    select('beta');
    select('delta');
    select('theta');
    select('gamma');
    select('vega');
    select('companyName');
    select('cspYield');
    select('ccYield');
    select('cspPremium');
    select('ccPremium');
    select('cspStrike');
    select('ccStrike');
    select('cspPremiumSource');
    select('ccPremiumSource');
});

queries.setQueryDefinition('positions_by_cc_yield', 'positions', ({ select }) => {
    select('symbol');
    select('quantity');
    select('averageCost');
    select('currentPrice');
    select('closePrice');
    select('costBasis');
    select('marketValue');
    select('dailyPnl');
    select('dailyPnlPct');
    select('ivRank');
    select('rsi');
    select('beta');
    select('delta');
    select('theta');
    select('gamma');
    select('vega');
    select('companyName');
    select('cspYield');
    select('ccYield');
    select('cspPremium');
    select('ccPremium');
    select('cspStrike');
    select('ccStrike');
    select('cspPremiumSource');
    select('ccPremiumSource');
});

// 2. Opportunities sorting
queries.setQueryDefinition('opportunities_by_date', 'opportunities', ({ select }) => {
    select('symbol');
    select('description');
    select('strategy');
    select('strike');
    select('expiration');
    select('premium');
    select('winProb');
    select('ivRank');
    select('currentPrice');
    select('delta');
    select('gamma');
    select('theta');
    select('vega');
    select('impliedVol');
    select('annualizedYield');
    select('reasoning');
    select('priority');
    select('analysis');
    select('context');
    select('createdAt');
});

queries.setQueryDefinition('opportunities_by_priority', 'opportunities', ({ select }) => {
    select('symbol');
    select('description');
    select('strategy');
    select('strike');
    select('expiration');
    select('premium');
    select('winProb');
    select('ivRank');
    select('currentPrice');
    select('delta');
    select('gamma');
    select('theta');
    select('vega');
    select('impliedVol');
    select('annualizedYield');
    select('reasoning');
    select('priority');
    select('analysis');
    select('context');
    select('createdAt');

    // Select Priority as a calculated cell for sorting (handle nulls)
    select((get) => {
        const p = get('priority');
        return (typeof p === 'number' ? p : 99);
    }).as('priorityValue');
});

// Create the persister
export const persister = isTestEnv
    ? {
        startAutoLoad: async () => undefined,
        startAutoSave: async () => undefined,
        stopAutoLoad: async () => undefined,
        stopAutoSave: async () => undefined,
    }
    : createExpoSqlitePersister(store, db as SQLite.SQLiteDatabase);

// Initialize persistence
export const initStore = async () => {
    await persister.startAutoLoad();
    migrateStore(store);
    await persister.startAutoSave();
};
