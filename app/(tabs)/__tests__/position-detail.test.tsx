import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import PositionDetail from "../../position/[symbol]";

const mockRefreshLiveOptionData = jest.fn();
const mockUsePosition = jest.fn();
let mockCurrentDteWindow = "three_weeks";
let mockCurrentRisk = "Moderate";
let returnLiveData = false;
let positionData: any = {};

jest.mock("expo-router", () => ({
    useLocalSearchParams: () => ({ symbol: "AAPL" }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/data/marketData", () => ({
    refreshLiveOptionData: (...args: any[]) => mockRefreshLiveOptionData(...args),
}));

jest.mock("../../../features/portfolio/hooks", () => ({
    __esModule: true,
    usePosition: () => mockUsePosition(),
    useOptionPositionsForSymbol: () => [],
}));

jest.mock("../../../features/settings/hooks", () => ({
    __esModule: true,
    useRiskProfile: () => ({ currentRisk: mockCurrentRisk }),
    useDteWindow: () => ({ currentDteWindow: mockCurrentDteWindow }),
}));

jest.mock("../../../services/analytics", () => ({
    Analytics: {
        logPositionView: jest.fn(),
    },
}));

jest.mock("../../../utils/marketHours", () => ({
    getMarketStatus: () => ({
        isOpen: true,
        statusLabel: "Market Open",
        detailLabel: "Closes in 1h",
    }),
}));

jest.mock("@expo/vector-icons", () => ({
    Ionicons: ({ name }: any) => `Icon-${name}`,
}));

jest.mock("../../../components/AnimatedLayout", () => {
    const { View } = jest.requireActual("react-native");
    const AnimatedLayoutMock = ({ children }: any) => <View>{children}</View>;
    AnimatedLayoutMock.displayName = "AnimatedLayoutMock";
    return AnimatedLayoutMock;
});

jest.mock("../../../components/GlassCard", () => {
    const { View } = jest.requireActual("react-native");
    const GlassCardMock = ({ children }: any) => <View>{children}</View>;
    GlassCardMock.displayName = "GlassCardMock";
    return GlassCardMock;
});

jest.mock("../../../components/HistoricalChart", () => {
    const { View } = jest.requireActual("react-native");
    const HistoricalChartMock = () => <View testID="historical-chart" />;
    HistoricalChartMock.displayName = "HistoricalChartMock";
    return HistoricalChartMock;
});

jest.mock("../../../components/SegmentedControl", () => {
    const { View } = jest.requireActual("react-native");
    const SegmentedControlMock = () => <View />;
    SegmentedControlMock.displayName = "SegmentedControlMock";
    return SegmentedControlMock;
});

jest.mock("../../../services/marketHistory", () => ({
    getHistoricalBarsCached: jest.fn().mockResolvedValue({ bars: [], source: 'cache-warm' }),
}));

jest.mock("../../../features/portfolio/components/WheelActionDetailModal", () => {
    const { Text } = jest.requireActual("react-native");
    const WheelActionDetailModalMock = ({ isVisible, expiration }: any) => (
        isVisible ? <Text testID="wheel-modal-expiration">{expiration}</Text> : null
    );
    WheelActionDetailModalMock.displayName = "WheelActionDetailModalMock";
    return WheelActionDetailModalMock;
});

describe("PositionDetail", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentDteWindow = "three_weeks";
        mockCurrentRisk = "Moderate";
        returnLiveData = false;
        positionData = {
            symbol: "AAPL",
            quantity: 100,
            averageCost: 100,
            currentPrice: 110,
            ccYield: 12.3,
            ccPremium: 1.2,
            ccPremiumSource: "mid",
            ccStrike: 120,
            ccExpiration: "2026-02-06",
            ccDelta: 0.2,
            ccGamma: 0.01,
            ccTheta: -0.02,
            ccVega: 0.1,
        };
        mockUsePosition.mockImplementation(() => positionData);
        mockRefreshLiveOptionData.mockImplementation(async (_symbols, _targetWinProb, dteWindow) => {
            if (dteWindow === "one_week" && returnLiveData) {
                positionData = {
                    ...positionData,
                    ccExpiration: "2024-09-06",
                    ccStrike: 125,
                    ccPremium: 1.4,
                    ccYield: 8.8,
                };
                return {
                    results: [{
                        symbol: "AAPL",
                        cc: {
                            expiration: "2024-09-06",
                            strike: 125,
                            premium: 1.4,
                            annualizedYield: 8.8,
                        }
                    }]
                };
            }
            return { results: [{ symbol: "AAPL" }] };
        });
    });

    it("refreshes live expirations with the current DTE before review trade", async () => {
        const { getByText, getByTestId, queryByText, rerender } = render(<PositionDetail />);

        await waitFor(() => {
            expect(mockRefreshLiveOptionData).toHaveBeenCalled();
        });

        mockCurrentDteWindow = "one_week";
        rerender(<PositionDetail />);

        const callCountBefore = mockRefreshLiveOptionData.mock.calls.length;
        returnLiveData = true;
        await waitFor(() => {
            expect(queryByText("Refreshing...")).toBeNull();
        });
        fireEvent.press(getByText("Review Trade"));

        await waitFor(() => {
            expect(mockRefreshLiveOptionData.mock.calls.length).toBe(callCountBefore + 1);
        });
        const lastCall = mockRefreshLiveOptionData.mock.calls[mockRefreshLiveOptionData.mock.calls.length - 1];
        expect(lastCall?.[2]).toBe("one_week");

        await waitFor(() => {
            expect(getByTestId("wheel-modal-expiration").props.children).toBe("2024-09-06");
        });
    });
});
