import { IBKRExecution, IBKROrder } from "./ibkrSyncTypes";

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
    if (items.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

export const stripUndefined = <T extends Record<string, unknown>>(value: T): T => {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as T;
};

export const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const buildExecutionKey = (exec: IBKRExecution) => {
    const suffix = exec.conId ?? exec.localSymbol ?? exec.symbol ?? "";
    const right = exec.right ?? "";
    const strike = exec.strike ?? "";
    const expiration = exec.expiration ?? "";
    return `${exec.execId}|${suffix}|${right}|${strike}|${expiration}`;
};

export const buildExecutionDocId = (exec: IBKRExecution, execIdCounts: Map<string, number>) => {
    const execId = exec.execId;
    if ((execIdCounts.get(execId) ?? 0) <= 1) {
        return execId;
    }
    let suffix = "";
    if (Number.isFinite(exec.conId ?? NaN)) {
        suffix = `con_${exec.conId}`;
    } else if (exec.localSymbol) {
        suffix = exec.localSymbol;
    } else {
        suffix = `${exec.symbol}_${exec.right ?? ""}_${exec.strike ?? ""}_${exec.expiration ?? ""}`;
    }
    return `${execId}_${sanitizeId(suffix) || "dup"}`;
};

export const buildOrderDocId = (order: IBKROrder, userId: string) => {
    if (Number.isFinite(order.orderId)) {
        return `ord_${order.orderId}`;
    }
    if (Number.isFinite(order.permId)) {
        return `ord_${order.permId}`;
    }
    const symbol = sanitizeId(order.symbol || "unknown");
    const action = sanitizeId(order.action || "UNK");
    const quantity = Number.isFinite(order.totalQuantity) ? order.totalQuantity : 0;
    const price = Number.isFinite(order.lmtPrice)
        ? order.lmtPrice
        : Number.isFinite(order.auxPrice)
            ? order.auxPrice
            : 0;
    const suffix = sanitizeId(userId);
    return `ord_${symbol}_${action}_${quantity}_${price}_${suffix}`;
};
