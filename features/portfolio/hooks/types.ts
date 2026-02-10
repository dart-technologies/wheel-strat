import { OptionPosition, Position } from '@wheel-strat/shared';

export type PositionSortMode = 'marketValue' | 'cspYield' | 'ccYield' | 'symbol' | 'dailyPnL' | 'costBasis' | 'unrealizedPnL';

export type PositionGroup = {
    symbol: string;
    stock?: Position;
    options: OptionPosition[];
    contractCount: number;
    marketValue: number;
    dailyPnL: number;
    costBasis: number;
    unrealizedPnL: number;
    ccYield?: number;
    cspYield?: number;
};
