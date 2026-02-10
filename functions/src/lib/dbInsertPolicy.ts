import type { Knex } from "knex";
import { withForceUpdate } from "@/lib/cloudsql";

type InsertOptions = {
    allowUpdate?: boolean;
    forceUpdate?: boolean;
};

export async function insertHistoricalRows(
    db: Knex,
    rows: Array<Record<string, any>>,
    options: InsertOptions = {}
) {
    if (!rows.length) return;
    const allowUpdate = Boolean(options.allowUpdate);

    const exec = async (trx: Knex) => {
        const query = trx('historical_prices')
            .insert(rows)
            .onConflict(['symbol', 'date']);
        if (allowUpdate) {
            await query.merge();
        } else {
            await query.ignore();
        }
    };

    if (allowUpdate && options.forceUpdate) {
        await withForceUpdate(exec);
        return;
    }
    await exec(db);
}

export async function insertIntradayRows(
    db: Knex,
    rows: Array<Record<string, any>>,
    options: InsertOptions = {}
) {
    if (!rows.length) return;
    const allowUpdate = Boolean(options.allowUpdate);

    const exec = async (trx: Knex) => {
        const query = trx('intraday_prices')
            .insert(rows)
            .onConflict(['symbol', 'timestamp', 'bar_size', 'regular_trading_hours', 'adjusted']);
        if (allowUpdate) {
            await query.merge();
        } else {
            await query.ignore();
        }
    };

    if (allowUpdate && options.forceUpdate) {
        await withForceUpdate(exec);
        return;
    }
    await exec(db);
}
