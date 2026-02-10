import { View } from 'react-native';

const MockChart = ({ children }) => <View>{children}</View>;

module.exports = {
    CartesianChart: MockChart,
    Area: MockChart,
    Line: MockChart,
    Bar: MockChart,
    Pie: MockChart,
    Polar: MockChart,
    Scatter: MockChart,
    useChartPressState: () => ({ state: {}, isActive: false }),
};
