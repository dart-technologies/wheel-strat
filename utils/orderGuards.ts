import type { Position } from '@wheel-strat/shared';
import { formatCurrency } from '@/utils/format';

type OrderGuardInput = {
    strategy?: string;
    symbol?: string;
    strike?: number;
    quantity?: number;
    buyingPower?: number;
    positions?: Record<string, Position> | null;
};

export type OrderGuardResult = {
    allowed: boolean;
    message?: string;
};

const normalizeStrategy = (strategy?: string) => (strategy || '').trim().toUpperCase();

const getPositionShares = (positions: Record<string, Position> | null | undefined, symbol?: string) => {
    if (!positions || !symbol) return 0;
    const position = positions[symbol.toUpperCase()];
    const shares = position?.quantity;
    return typeof shares === 'number' ? shares : Number(shares || 0);
};

export const getOrderGuard = (input: OrderGuardInput): OrderGuardResult => {
    const strategy = normalizeStrategy(input.strategy);
    const quantity = Math.max(1, Number(input.quantity || 1));
    const strike = Number(input.strike || 0);
    const buyingPower = Number(input.buyingPower || 0);

    const isCoveredCall = strategy.includes('CALL') || strategy === 'CC';
    const isCashSecuredPut = strategy.includes('PUT') || strategy === 'CSP';

    if (isCashSecuredPut && Number.isFinite(strike) && strike > 0) {
        const requiredBuyingPower = strike * 100 * quantity;
        if (Number.isFinite(buyingPower) && buyingPower < requiredBuyingPower) {
            return {
                allowed: false,
                message: `Insufficient buying power. Need ${formatCurrency(requiredBuyingPower)} but only ${formatCurrency(buyingPower)} is available.`
            };
        }
    }

    if (isCoveredCall && input.symbol) {
        const requiredShares = quantity * 100;
        const availableShares = getPositionShares(input.positions, input.symbol);
        if (Number.isFinite(availableShares) && availableShares < requiredShares) {
            return {
                allowed: false,
                message: `Not enough shares to cover this call. Need ${requiredShares} shares, available ${availableShares}.`
            };
        }
    }

    return { allowed: true };
};
