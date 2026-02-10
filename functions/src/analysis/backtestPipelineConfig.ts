import { SplitFactor } from './backtestPipelineTypes';
import { parseBooleanEnv, parseNumberEnv } from './backtestPipelineUtils';

export const WATCHLIST = (process.env.MARATHON_SYMBOLS || 'NVDA,TSLA,AAPL,MSFT,GOOGL,AMZN,META')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

export const PATTERN_INTRADAY_DROP_PCT = parseNumberEnv(process.env.PATTERN_INTRADAY_DROP_PCT, 0.05);
export const PATTERN_INTRADAY_MAX_MINUTES = parseNumberEnv(process.env.PATTERN_INTRADAY_MAX_MINUTES, 240);
export const PATTERN_INTRADAY_REBOUND_MINUTES = parseNumberEnv(process.env.PATTERN_INTRADAY_REBOUND_MINUTES, 390);
export const PATTERN_INTRADAY_LOOKBACK_DAYS = parseNumberEnv(process.env.PATTERN_INTRADAY_LOOKBACK_DAYS, 365);
export const INTRADAY_BAR_SIZE = process.env.IBKR_INTRADAY_BAR_SIZE || '1 min';
export const INTRADAY_USE_RTH = parseBooleanEnv(process.env.IBKR_INTRADAY_USE_RTH, true);

export const PATTERN_DAILY_DROP_PCT = parseNumberEnv(process.env.PATTERN_DAILY_DROP_PCT, 0.10);
export const PATTERN_DAILY_MAX_MINUTES = parseNumberEnv(process.env.PATTERN_DAILY_MAX_MINUTES, 3 * 1440);
export const PATTERN_DAILY_REBOUND_MINUTES = parseNumberEnv(process.env.PATTERN_DAILY_REBOUND_MINUTES, 5 * 1440);
export const PATTERN_DAILY_EXTREME_DROP_PCT = parseNumberEnv(process.env.PATTERN_DAILY_EXTREME_DROP_PCT, 0.30);

export const ALERT_COOLDOWN_MINUTES = parseNumberEnv(process.env.PATTERN_ALERT_COOLDOWN_MINUTES, 120);
export const ALERT_MIN_REBOUND_RATE = parseNumberEnv(process.env.PATTERN_ALERT_MIN_REBOUND_RATE, 0.6);
export const ALERT_MIN_IV_RANK = parseNumberEnv(process.env.PATTERN_ALERT_MIN_IV_RANK, 60);
export const ALERT_MIN_PREMIUM_RATIO = parseNumberEnv(process.env.PATTERN_ALERT_MIN_PREMIUM_RATIO, 1.2);

export const SCENARIO_RETURN_TOLERANCE = parseNumberEnv(process.env.SCENARIO_RETURN_TOLERANCE, 0.15);
export const SCENARIO_DRAWDOWN_TOLERANCE = parseNumberEnv(process.env.SCENARIO_DRAWDOWN_TOLERANCE, 0.15);
export const SCENARIO_ALERT_COOLDOWN_HOURS = parseNumberEnv(process.env.SCENARIO_ALERT_COOLDOWN_HOURS, 24);

export const PREMIUM_ANOMALY_MIN_RATIO = parseNumberEnv(process.env.PREMIUM_ANOMALY_MIN_RATIO, 1.2);
export const PREMIUM_ANOMALY_MIN_IV_RANK = parseNumberEnv(process.env.PREMIUM_ANOMALY_MIN_IV_RANK, 55);
export const PREMIUM_ANOMALY_COOLDOWN_MINUTES = parseNumberEnv(process.env.PREMIUM_ANOMALY_COOLDOWN_MINUTES, 180);
export const PREMIUM_ANOMALY_RISK_FREE_RATE = parseNumberEnv(process.env.PREMIUM_ANOMALY_RISK_FREE_RATE, 0.04);
export const STRATEGY_ALERT_MIN_WIN_RATE = parseNumberEnv(process.env.STRATEGY_ALERT_MIN_WIN_RATE, 0.6);
export const STRATEGY_ALERT_COOLDOWN_HOURS = parseNumberEnv(process.env.STRATEGY_ALERT_COOLDOWN_HOURS, 24);
export const VOL_BUCKET_WINDOW_DAYS = parseNumberEnv(process.env.VOL_BUCKET_WINDOW_DAYS, 20);
export const VOL_BUCKET_MIN_SAMPLES = parseNumberEnv(process.env.VOL_BUCKET_MIN_SAMPLES, 60);
export const VOL_BUCKET_LOW_PCT = parseNumberEnv(process.env.VOL_BUCKET_LOW_PCT, 0.33);
export const VOL_BUCKET_HIGH_PCT = parseNumberEnv(process.env.VOL_BUCKET_HIGH_PCT, 0.66);
export const VOL_REGIME_BACKFILL_DAYS = parseNumberEnv(process.env.VOL_REGIME_BACKFILL_DAYS, 365);
export const VOL_REGIME_BATCH_SIZE = parseNumberEnv(process.env.VOL_REGIME_BATCH_SIZE, 500);
export const SPLIT_RATIO_TOLERANCE = parseNumberEnv(process.env.SPLIT_RATIO_TOLERANCE, 0.15);
export const SPLIT_MIN_RATIO = parseNumberEnv(process.env.SPLIT_MIN_RATIO, 0.75);
export const SPLIT_MAX_RATIO = parseNumberEnv(process.env.SPLIT_MAX_RATIO, 1.5);

export const SPLIT_CANONICAL_RATIOS = [
    0.05,
    0.1,
    0.125,
    0.142857,
    0.1667,
    0.2,
    0.25,
    0.3333,
    0.5,
    0.6667,
    0.75,
    1.5,
    2,
    3,
    4,
    5,
    7,
    10,
    20
];

export const splitFactorCache = new Map<string, SplitFactor[]>();
