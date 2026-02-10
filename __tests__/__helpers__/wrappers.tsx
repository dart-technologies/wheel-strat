import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'tinybase/ui-react';
import { store } from '@/data/store';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Standard test wrapper providing Store and SafeArea context.
 */
export const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <Provider store={store}>
            <SafeAreaProvider initialMetrics={{
                frame: { x: 0, y: 0, width: 0, height: 0 },
                insets: { top: 0, left: 0, right: 0, bottom: 0 },
            }}>
                {children}
            </SafeAreaProvider>
        </Provider>
    );
};

export const renderWithProviders = (ui: React.ReactElement, options?: any) =>
    render(ui, { wrapper: AllTheProviders, ...options });
