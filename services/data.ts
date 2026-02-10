import type { Store, Row, Cell } from 'tinybase';
import { SCHEMAS, SEED_DATA } from '@wheel-strat/shared';

export { SCHEMAS, SEED_DATA };

export const SEED_FLAG_KEY = 'seededSampleData';

type TableSchema = Record<string, { default?: unknown }>;
const TABLE_SCHEMAS: Record<string, TableSchema> = SCHEMAS as Record<string, TableSchema>;

const buildDefaultRow = (schema: TableSchema): Row => {
    const row: Row = {};
    Object.entries(schema).forEach(([cellId, cellSchema]) => {
        if (Object.prototype.hasOwnProperty.call(cellSchema, 'default')) {
            row[cellId] = cellSchema.default as Cell;
        }
    });
    return row;
};

export const seedStore = (store: Store) => {


    const hasPortfolioTable = store.hasTable('portfolio');

    
    const seedFlag = store.getValue(SEED_FLAG_KEY);
    if (seedFlag === false) {

        return;
    }

    // Check if portfolio has meaningful data (not just empty/zero values)
    const portfolioRow = store.getRow('portfolio', 'main');
    const netLiq = Number(portfolioRow?.netLiq);
    const hasPositions = Object.keys(store.getTable('positions') || {}).length > 0;
    const hasOptionPositions = Object.keys(store.getTable('optionPositions') || {}).length > 0;
    const hasRealPortfolioData = (Number.isFinite(netLiq) && netLiq !== 0) || hasPositions || hasOptionPositions;


    if (seedFlag === true) {

        return;
    }
    
    // Only skip seeding if we have real portfolio data
    if (hasPortfolioTable && hasRealPortfolioData) {

        return;
    }



    store.setTables({
        portfolio: SEED_DATA.portfolio,
        positions: SEED_DATA.positions,
        optionPositions: SEED_DATA.optionPositions,
        watchList: SEED_DATA.watchList,
        trades: SEED_DATA.trades,
        orders: SEED_DATA.orders,
        opportunities: SEED_DATA.opportunities,
        marketData: SEED_DATA.marketData,
        appSettings: SEED_DATA.appSettings,
        syncMetadata: SEED_DATA.syncMetadata,
        equityCurve: SEED_DATA.equityCurve,
        predictionHistory: SEED_DATA.predictionHistory,
        corporateActions: SEED_DATA.corporateActions,
        marketCalendar: SEED_DATA.marketCalendar,
        marketCache: SEED_DATA.marketCache,
    });
    store.setValue(SEED_FLAG_KEY, true);

};

type ClearSeedOptions = {
    preservePortfolio?: boolean;
    preservePositions?: boolean;
    preserveOptionPositions?: boolean;
    preserveSyncMetadata?: boolean;
};

export const clearSeedData = (store: Store, options: ClearSeedOptions = {}) => {
    if (store.getValue(SEED_FLAG_KEY) !== true) return;

    store.transaction(() => {
        if (!options.preservePositions) {
            store.delTable('positions');
        }
        if (!options.preserveOptionPositions) {
            store.delTable('optionPositions');
        }
        store.delTable('trades');
        store.delTable('orders');
        store.delTable('opportunities');
        store.delTable('marketData');
        if (!options.preserveSyncMetadata) {
            store.delTable('syncMetadata');
        }
        store.delTable('equityCurve');
        store.delTable('predictionHistory');
        store.delTable('corporateActions');
        store.delTable('marketCalendar');
        store.delTable('marketCache');

        if (!options.preservePortfolio) {
            const portfolioDefaults = buildDefaultRow(TABLE_SCHEMAS.portfolio ?? {});
            if (Object.keys(portfolioDefaults).length > 0) {
                store.setRow('portfolio', 'main', portfolioDefaults);
            } else {
                store.delTable('portfolio');
            }
        }

        store.setValue(SEED_FLAG_KEY, false);
    });
};
