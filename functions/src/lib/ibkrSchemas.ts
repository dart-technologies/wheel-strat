import { z } from "zod";

const optionalNumber = z.preprocess((value: unknown) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}, z.number().optional());

const optionalString = z.preprocess((value: unknown) => {
    if (value === null || value === undefined) return undefined;
    const parsed = String(value).trim();
    return parsed ? parsed : undefined;
}, z.string().optional());

const numberArray = z.array(optionalNumber).transform((values: Array<number | undefined>) =>
    values.filter((value: number | undefined): value is number => typeof value === 'number')
);

const stringArray = z.array(optionalString).transform((values: Array<string | undefined>) =>
    values.filter((value: string | undefined): value is string => typeof value === 'string' && value.length > 0)
);

export const ibkrHealthSchema = z.object({
    connected: z.boolean().optional(),
    status: optionalString
}).passthrough();

export const ibkrMarketQuoteSchema = z.object({
    symbol: optionalString,
    last: optionalNumber,
    bid: optionalNumber,
    ask: optionalNumber,
    close: optionalNumber,
    volume: optionalNumber,
    source: optionalString,
    impliedVol: optionalNumber,
    modelOptPrice: optionalNumber,
    delta: optionalNumber,
    gamma: optionalNumber,
    theta: optionalNumber,
    vega: optionalNumber
}).passthrough();

export const ibkrMarketDataBatchSchema = z.object({
    results: z.array(ibkrMarketQuoteSchema).optional()
}).passthrough();

export const ibkrOptionChainSchema = z.object({
    symbol: optionalString,
    expirations: stringArray.optional(),
    strikes: numberArray.optional()
}).passthrough();

export const ibkrOptionChainBatchSchema = z.object({
    results: z.array(ibkrOptionChainSchema).optional()
}).passthrough();

export const ibkrOptionQuoteSchema = z.object({
    bid: optionalNumber,
    ask: optionalNumber,
    last: optionalNumber,
    close: optionalNumber,
    delta: optionalNumber,
    gamma: optionalNumber,
    theta: optionalNumber,
    vega: optionalNumber,
    modelOptPrice: optionalNumber,
    impliedVol: optionalNumber
}).passthrough();

export const ibkrOptionQuoteBatchItemSchema = ibkrOptionQuoteSchema.extend({
    symbol: optionalString,
    expiration: optionalString,
    right: optionalString,
    strike: optionalNumber
}).passthrough();

export const ibkrOptionQuoteBatchSchema = z.object({
    results: z.array(ibkrOptionQuoteBatchItemSchema).optional()
}).passthrough();

const ibkrHistoricalBarSchema = z.object({
    close: optionalNumber,
    average: optionalNumber,
    open: optionalNumber,
    high: optionalNumber,
    low: optionalNumber,
    volume: optionalNumber,
    date: optionalString
}).passthrough();

export const ibkrHistoricalSchema = z.object({
    bars: z.array(ibkrHistoricalBarSchema).optional()
}).passthrough();

export const ibkrPositionSchema = z.object({
    account: optionalString,
    symbol: optionalString,
    quantity: optionalNumber,
    avgCost: optionalNumber,
    secType: optionalString,
    right: optionalString,
    strike: optionalNumber,
    expiration: optionalString,
    localSymbol: optionalString,
    conId: optionalNumber,
    multiplier: optionalNumber,
    marketPrice: optionalNumber,
    marketValue: optionalNumber,
    realizedPnl: optionalNumber,
    unrealizedPnl: optionalNumber
}).passthrough();

export const ibkrPositionsSchema = z.object({
    positions: z.array(ibkrPositionSchema).optional(),
    count: optionalNumber
}).passthrough();

export const ibkrAccountSummarySchema = z.object({
    NetLiquidation: optionalNumber,
    TotalCashValue: optionalNumber,
    TotalCashBalance: optionalNumber,
    BuyingPower: optionalNumber,
    AvailableFunds: optionalNumber,
    ExcessLiquidity: optionalNumber,
    DailyPnL: optionalNumber,
    RealizedPnL: optionalNumber,
    UnrealizedPnL: optionalNumber
}).passthrough();

export const ibkrExecutionSchema = z.object({
    execId: optionalString,
    time: optionalString,
    symbol: optionalString,
    secType: optionalString,
    side: optionalString,
    shares: optionalNumber,
    price: optionalNumber,
    avgPrice: optionalNumber,
    commission: optionalNumber,
    orderRef: optionalString,
    cumQty: optionalNumber,
    strike: optionalNumber,
    right: optionalString,
    expiration: optionalString,
    localSymbol: optionalString,
    conId: optionalNumber,
    multiplier: optionalNumber
}).passthrough();

export const ibkrExecutionsSchema = z.object({
    executions: z.array(ibkrExecutionSchema).optional()
}).passthrough();

export const ibkrOrderSchema = z.object({
    orderId: optionalNumber,
    permId: optionalNumber,
    status: optionalString,
    action: optionalString,
    totalQuantity: optionalNumber,
    remaining: optionalNumber,
    filled: optionalNumber,
    avgFillPrice: optionalNumber,
    orderType: optionalString,
    lmtPrice: optionalNumber,
    auxPrice: optionalNumber,
    initMarginChange: optionalNumber,
    tif: optionalString,
    account: optionalString,
    orderRef: optionalString,
    symbol: optionalString,
    secType: optionalString,
    right: optionalString,
    strike: optionalNumber,
    expiration: optionalString,
    localSymbol: optionalString,
    conId: optionalNumber,
    multiplier: optionalNumber,
    currency: optionalString,
    exchange: optionalString
}).passthrough();

export const ibkrOrdersSchema = z.object({
    orders: z.array(ibkrOrderSchema).optional(),
    count: optionalNumber
}).passthrough();

export function parseIbkrResponse<T extends z.ZodTypeAny>(
    schema: T,
    payload: unknown,
    context: string
): z.infer<T> | null {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
        console.warn(`[ibkrSchemas] ${context} payload failed validation`, parsed.error.issues);
        return null;
    }
    return parsed.data;
}
