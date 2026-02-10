export function suggestStrategy(symbol: string, changePercent: number): string {
    if (changePercent > 0) {
        return `Covered Call on ${symbol} - capture elevated premium`;
    }
    return `Cash-Secured Put on ${symbol} - potential entry at discount`;
}
