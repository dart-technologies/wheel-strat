import { useMemo } from 'react';
import { useTable } from 'tinybase/ui-react';
import { store } from '@/data/store';
import { Trade } from '@wheel-strat/shared';
import { normalizeExpiration } from './portfolioUtils';

type TradeLot = { quantity: number; price: number; multiplier?: number };

const buildTradeKey = (trade: Trade) => {
    const symbol = trade.symbol?.toUpperCase?.() || '';
    if (!symbol) return null;
    const type = trade.type?.toUpperCase?.() || '';
    const right = trade.right?.toUpperCase?.() || '';
    const hasStrike = Number.isFinite(Number(trade.strike));
    const expiration = normalizeExpiration(trade.expiration);
    const isOption = type === 'CC'
        || type === 'CSP'
        || (trade.secType || '').toUpperCase() === 'OPT'
        || Boolean(right)
        || hasStrike
        || Boolean(expiration);
    if (!isOption) {
        return { key: symbol, isOption: false };
    }
    if (Number.isFinite(Number(trade.conId))) {
        return { key: `OPT:${trade.conId}`, isOption: true };
    }
    if (trade.localSymbol) {
        return { key: `OPT:${trade.localSymbol}`, isOption: true };
    }
    const strike = hasStrike ? Number(trade.strike) : 0;
    return { key: `OPT:${symbol}:${right || 'X'}:${strike}:${expiration || 'na'}`, isOption: true };
};

function calculateRealizedPnL(trades: Trade[]) {
    const lotsBySymbol: Record<string, TradeLot[]> = {};
    let realizedPnL = 0;
    let hasSells = false;

    const orderedTrades = trades
        .filter((trade) => trade && trade.symbol && (
            trade.type === 'BUY'
            || trade.type === 'SELL'
            || trade.type === 'CC'
            || trade.type === 'CSP'
        ))
        .sort((a, b) => {
            const dateOrder = a.date.localeCompare(b.date);
            if (dateOrder !== 0) return dateOrder;
            return a.id.localeCompare(b.id);
        });

    orderedTrades.forEach((trade) => {
        const keyInfo = buildTradeKey(trade);
        if (!keyInfo) return;
        const quantity = Number(trade.quantity);
        const price = Number(trade.price);
        const commission = Number(trade.commission);
        if (!Number.isFinite(quantity) || quantity === 0) return;
        if (!Number.isFinite(price)) return;
        if (Number.isFinite(commission) && commission !== 0) {
            realizedPnL -= commission;
        }

        const isBuy = trade.type === 'BUY';
        const isSell = trade.type === 'SELL' || trade.type === 'CC' || trade.type === 'CSP';
        if (!isBuy && !isSell) return;
        const signedQty = (isBuy ? 1 : -1) * Math.abs(quantity);
        if (signedQty < 0) hasSells = true;

        const multiplier = keyInfo.isOption
            ? (Number(trade.multiplier) || 100)
            : 1;

        const lots = lotsBySymbol[keyInfo.key] || [];
        let remaining = signedQty;
        while (remaining !== 0 && lots.length > 0) {
            const lot = lots[0];
            if (Math.sign(lot.quantity) === Math.sign(remaining)) break;
            const usedQty = Math.min(Math.abs(remaining), Math.abs(lot.quantity));
            const lotMultiplier = (lot as { multiplier?: number }).multiplier ?? multiplier;
            if (remaining < 0) {
                realizedPnL += (price - lot.price) * usedQty * lotMultiplier;
            } else {
                realizedPnL += (lot.price - price) * usedQty * lotMultiplier;
            }
            if (lot.quantity < 0) {
                lot.quantity += usedQty;
            } else {
                lot.quantity -= usedQty;
            }
            if (Math.abs(lot.quantity) <= 1e-8) {
                lots.shift();
            }
            remaining = remaining < 0 ? remaining + usedQty : remaining - usedQty;
        }

        if (remaining !== 0) {
            (lots as Array<{ quantity: number; price: number; multiplier?: number }>).push({
                quantity: remaining,
                price,
                multiplier
            });
        }
        lotsBySymbol[keyInfo.key] = lots;
    });

    return { realizedPnL, hasSells };
}

export function useRealizedPnL() {
    const trades = useTable('trades', store) as Record<string, Trade> | undefined;

    return useMemo(() => {
        const tradeList = trades ? Object.values(trades) : [];


        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const parseTradeDate = (value?: string) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const inRange = (trade: Trade, start: Date) => {
            const date = parseTradeDate(trade.date);
            return date ? date.getTime() >= start.getTime() : false;
        };

        const total = calculateRealizedPnL(tradeList);
        const month = calculateRealizedPnL(tradeList.filter((trade) => inRange(trade, monthStart)));
        const year = calculateRealizedPnL(tradeList.filter((trade) => inRange(trade, yearStart)));

        return {
            realizedPnL: total.realizedPnL,
            hasSells: total.hasSells,
            monthPnL: month.realizedPnL,
            monthHasSells: month.hasSells,
            yearPnL: year.realizedPnL,
            yearHasSells: year.hasSells
        };
    }, [trades]);
}
