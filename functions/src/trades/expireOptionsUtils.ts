export type RawTrade = Record<string, any>;

export type ExpiredOptionClosure = {
    userId: string;
    contractKey: string;
    symbol: string;
    right: string;
    strike: number;
    expiration: string;
    multiplier: number;
    quantity: number;
    type: "BUY" | "SELL";
    secType: string;
    localSymbol?: string;
    conId?: number;
};

const toNumber = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toUpper = (value?: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : "");

const parseExpiration = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{8}$/.test(trimmed)) {
        const year = trimmed.slice(0, 4);
        const month = trimmed.slice(4, 6);
        const day = trimmed.slice(6, 8);
        const iso = `${year}-${month}-${day}T00:00:00Z`;
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatExpiration = (date: Date) => date.toISOString().split("T")[0];

const buildContractKey = (symbol: string, right: string, strike: number, expiration: string, multiplier: number) => (
    `${symbol}|${right}|${strike}|${expiration}|${multiplier}`
);

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const buildVirtualTradeId = (userId: string, contractKey: string) => (
    `virt_${sanitizeId(userId)}_${sanitizeId(contractKey)}`
);

const resolveOptionTrade = (trade: RawTrade) => {
    const raw = trade.raw as Record<string, unknown> | undefined;
    const secType = toUpper(trade.secType ?? raw?.secType);
    const right = toUpper(trade.right ?? raw?.right);
    const symbol = toUpper(trade.symbol ?? raw?.symbol);
    const strike = toNumber(trade.strike ?? raw?.strike);
    const expirationRaw = trade.expiration ?? raw?.expiration ?? raw?.lastTradeDateOrContractMonth;
    const expirationDate = expirationRaw ? parseExpiration(String(expirationRaw)) : null;
    const multiplier = toNumber(trade.multiplier ?? raw?.multiplier) ?? 100;
    const isOption = secType === "OPT" || Boolean(right) || Number.isFinite(strike ?? NaN) || Boolean(expirationDate);
    if (!isOption || !symbol || !right || !strike || !expirationDate) return null;

    const sideRaw = toUpper(trade.type ?? raw?.side ?? raw?.action);
    const side = sideRaw === "SELL" || sideRaw === "SLD" || sideRaw === "CC" || sideRaw === "CSP"
        ? "SELL"
        : sideRaw === "BUY" || sideRaw === "BOT"
            ? "BUY"
            : null;
    if (!side) return null;

    const quantity = Math.abs(toNumber(trade.quantity ?? raw?.shares) ?? 0);
    if (!quantity) return null;

    return {
        symbol,
        right,
        strike,
        expirationDate,
        expiration: formatExpiration(expirationDate),
        multiplier,
        side,
        quantity,
        localSymbol: trade.localSymbol ?? raw?.localSymbol,
        conId: toNumber(trade.conId ?? raw?.conId)
    };
};

export function buildExpiredOptionClosures(trades: RawTrade[], now = new Date()): ExpiredOptionClosure[] {
    const perUser = new Map<string, Map<string, { openQty: number; meta: ReturnType<typeof resolveOptionTrade> }>>();

    trades.forEach((trade) => {
        const userId = typeof trade.userId === "string" ? trade.userId : null;
        if (!userId) return;
        const resolved = resolveOptionTrade(trade);
        if (!resolved) return;
        const contractKey = buildContractKey(
            resolved.symbol,
            resolved.right,
            resolved.strike,
            resolved.expiration,
            resolved.multiplier
        );
        const userMap = perUser.get(userId) ?? new Map();
        const existing = userMap.get(contractKey);
        const openQty = (existing?.openQty ?? 0) + (resolved.side === "SELL" ? resolved.quantity : -resolved.quantity);
        userMap.set(contractKey, { openQty, meta: resolved });
        perUser.set(userId, userMap);
    });

    const closures: ExpiredOptionClosure[] = [];
    const nowTime = now.getTime();

    perUser.forEach((contracts, userId) => {
        contracts.forEach((state, contractKey) => {
            const { openQty, meta } = state;
            if (!meta) return;
            if (Math.abs(openQty) < 1e-6) return;
            if (meta.expirationDate.getTime() > nowTime) return;
            const type = openQty > 0 ? "BUY" : "SELL";
            closures.push({
                userId,
                contractKey,
                symbol: meta.symbol,
                right: meta.right,
                strike: meta.strike,
                expiration: meta.expiration,
                multiplier: meta.multiplier,
                quantity: Math.abs(openQty),
                type,
                secType: "OPT",
                localSymbol: meta.localSymbol,
                conId: meta.conId
            });
        });
    });

    return closures;
}

export const chunkArray = <T,>(items: T[], size: number) => {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};
