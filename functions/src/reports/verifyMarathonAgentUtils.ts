export type PredictionOutcome = {
    outcome: "win" | "loss" | "neutral";
    success?: boolean;
};

export const normalizeSymbol = (symbol?: string) => (symbol || "").toUpperCase();

export const parseNumber = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const parseDate = (value: unknown) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof (value as { toDate?: () => Date }).toDate === "function") {
        const parsed = (value as { toDate: () => Date }).toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

export const extractAnalysis = (value: unknown) => {
    if (!value) return null;
    if (typeof value === "object") return value as Record<string, any>;
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as Record<string, any>;
        } catch {
            return null;
        }
    }
    return null;
};

export const resolveStrategyType = (strategy?: string) => {
    const normalized = (strategy || "").toLowerCase();
    if (normalized.includes("put")) return "csp";
    if (normalized.includes("call")) return "cc";
    return null;
};

export const evaluateOutcome = (
    strategyType: "csp" | "cc",
    strike: number,
    currentPrice: number
): PredictionOutcome => {
    if (strategyType === "csp") {
        const win = currentPrice >= strike;
        return { outcome: win ? "win" : "loss", success: win };
    }
    const win = currentPrice <= strike;
    return { outcome: win ? "win" : "loss", success: win };
};

export const computeVolatility = (prices?: number[]) => {
    if (!prices || prices.length < 2) return null;
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const prev = prices[i - 1];
        const next = prices[i];
        if (!Number.isFinite(prev) || !Number.isFinite(next) || prev <= 0) continue;
        returns.push(Math.log(next / prev));
    }
    if (returns.length < 2) return null;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100;
};

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const buildPredictionId = (symbol: string, createdAt: Date | null, strike: number | null, strategy: string) => {
    const dateLabel = createdAt ? createdAt.toISOString().split("T")[0] : "unknown";
    return `pred_${sanitizeId(symbol)}_${dateLabel}_${sanitizeId(strategy)}_${strike ?? "na"}`;
};
