import { parseBooleanEnv, parseNumberEnv } from './historicalDataUtils';

export const WATCHLIST = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];

export const DAILY_BAR_SIZE = process.env.IBKR_DAILY_BAR_SIZE || '1 day';
export const DAILY_WHAT_TO_SHOW = process.env.IBKR_DAILY_WHAT_TO_SHOW || 'TRADES';
export const DAILY_USE_RTH = parseBooleanEnv(process.env.IBKR_DAILY_USE_RTH, true);
export const DAILY_MAX_DAYS = parseNumberEnv(process.env.IBKR_DAILY_MAX_DAYS, 3650);
export const DAILY_GAP_BUFFER_DAYS = parseNumberEnv(process.env.IBKR_DAILY_GAP_BUFFER_DAYS, 5);
export const DAILY_SEED_DURATION = process.env.IBKR_DAILY_SEED_DURATION || '5 Y';
export const DAILY_BACKFILL_YEARS = parseNumberEnv(process.env.IBKR_DAILY_BACKFILL_YEARS, 0);

export const INTRADAY_ENABLED = parseBooleanEnv(process.env.IBKR_INTRADAY_SYNC_ENABLED, false);
export const INTRADAY_BAR_SIZE = process.env.IBKR_INTRADAY_BAR_SIZE || '1 min';
export const INTRADAY_DURATION = process.env.IBKR_INTRADAY_DURATION || '2 D';
export const INTRADAY_WHAT_TO_SHOW = process.env.IBKR_INTRADAY_WHAT_TO_SHOW || 'TRADES';
export const INTRADAY_USE_RTH = parseBooleanEnv(process.env.IBKR_INTRADAY_USE_RTH, true);
export const INTRADAY_GAP_ENABLED = parseBooleanEnv(process.env.IBKR_INTRADAY_GAP_ENABLED, true);
export const INTRADAY_GAP_LOOKBACK_DAYS = parseNumberEnv(process.env.IBKR_INTRADAY_GAP_LOOKBACK_DAYS, 30);
export const INTRADAY_GAP_MAX_DAYS = parseNumberEnv(process.env.IBKR_INTRADAY_GAP_MAX_DAYS, 5);
export const INTRADAY_GAP_SLEEP_MS = parseNumberEnv(process.env.IBKR_INTRADAY_GAP_SLEEP_MS, 1200);
