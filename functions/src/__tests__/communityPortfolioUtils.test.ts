import {
    buildPositionId,
    normalizeAccountSummary,
    normalizePosition,
    stripUndefined
} from "@/portfolio/communityPortfolioUtils";

describe("communityPortfolioUtils", () => {
    it("normalizes stock positions and computes market value", () => {
        const normalized = normalizePosition({
            symbol: " tsla ",
            quantity: "2",
            avgCost: 100,
            marketPrice: 105,
            secType: "STK"
        });

        expect(normalized).not.toBeNull();
        expect(normalized?.symbol).toBe("TSLA");
        expect(normalized?.quantity).toBe(2);
        expect(normalized?.currentPrice).toBe(105);
        expect(normalized?.marketValue).toBe(210);
        expect(buildPositionId(normalized)).toBe("stk_TSLA");
    });

    it("normalizes option positions and computes market value with multiplier", () => {
        const normalized = normalizePosition({
            symbol: "META",
            quantity: -1,
            avgCost: 1.25,
            marketPrice: 0.5,
            secType: "OPT",
            right: "P",
            strike: 560,
            expiration: "20260206",
            multiplier: 100,
            conId: 841969143
        });

        expect(normalized).not.toBeNull();
        expect(normalized?.marketValue).toBe(-50);
        expect(buildPositionId(normalized)).toBe("opt_841969143");
    });

    it("returns null when symbol missing or quantity is zero", () => {
        expect(normalizePosition({ symbol: "", quantity: 1 })).toBeNull();
        expect(normalizePosition({ symbol: "AAPL", quantity: 0 })).toBeNull();
    });

    it("strips undefined and non-finite numbers", () => {
        const cleaned = stripUndefined({
            ok: 1,
            nope: undefined,
            nan: Number.NaN,
            inf: Number.POSITIVE_INFINITY,
            text: "hello"
        });

        expect(cleaned).toEqual({ ok: 1, text: "hello" });
    });

    it("normalizes account summary with fallbacks", () => {
        const summary = normalizeAccountSummary({
            TotalCashValue: "100",
            AvailableFunds: 55
        });

        expect(summary.cash).toBe(100);
        expect(summary.netLiq).toBe(100);
        expect(summary.buyingPower).toBe(55);
    });
});
