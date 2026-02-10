export type SplitFactor = {
    date: string;
    factor: number;
    detectedRatio?: number;
    source?: string;
    confidence?: number;
};

export type VolBucket = 'low' | 'mid' | 'high';

export type VolThresholds = {
    lowMax: number;
    midMax: number;
    source: string;
    windowDays: number;
};

export type StrategyBucketAccumulator = {
    wins: number;
    total: number;
    totalReturn: number;
    maxDrawdown: number;
};
