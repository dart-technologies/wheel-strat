import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Appearance } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { initStore, store } from "@/data/store";
import { seedStore } from "@/services/data";
import { startSyncServices } from "@/services/sync";
import { Provider } from 'tinybase/ui-react';
import { Theme } from "@/constants/theme";
import { initCrashlytics } from "@/services/crashlytics";
import { registerForPushNotifications, setupNotificationListeners } from "@/services/notifications";
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from "@/hooks/useAuth";
import AuthGate from "@/features/auth/AuthGate";
import AtmosphericBackground from "@/components/AtmosphericBackground";
import { useUserOrderSync, useUserTradeSync } from "@/features/trades/syncHooks";
import { useCommunityPortfolioDeltaSync, useCorporateActionsSync, useMarketCalendarSync, useUserPortfolioSync } from "@/features/portfolio/syncHooks";
import { logAuthSnapshotOnce } from "@/services/authDiagnostics";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const { isAuthenticated, initializing, user } = useAuth();

    // Prevent screen from sleeping
    useKeepAwake();

    // Keep trades synced for the authenticated user across the app
    useUserTradeSync(user?.uid);
    useUserOrderSync(user?.uid);
    useUserPortfolioSync(user?.uid);
    // useCommunityPortfolioSync(Boolean(user)); // Replaced by user sync
    useCommunityPortfolioDeltaSync(false); // Disabled as requested
    useMarketCalendarSync(Boolean(user));
    useCorporateActionsSync(Boolean(user));

    useEffect(() => {
        const setup = async () => {
            try {
                await initStore();
                // Only seed if we don't have real data yet
                // seedStore checks the flag internally and skips if already seeded
                const portfolioRow = store.getRow('portfolio', 'main');
                const netLiq = Number(portfolioRow?.netLiq);
                const hasRealData = Number.isFinite(netLiq) && netLiq !== 0;
                if (!hasRealData) {
                    seedStore(store);
                }
                const stopSync = startSyncServices();
                return () => stopSync();
            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
            }
        };
        const cleanupPromise = setup();
        return () => {
            cleanupPromise.then(cleanup => cleanup?.());
        };
    }, []);

    useEffect(() => {
        if (!isReady || initializing) return;
        logAuthSnapshotOnce('root_layout');
    }, [isReady, initializing]);

    // Force Dark Mode
    useEffect(() => {
        Appearance.setColorScheme('dark');
    }, []);

    useEffect(() => {
        if (!isReady) return;

        const init = async () => {
            try {
                await initCrashlytics();
                await registerForPushNotifications();
            } catch (error) {
                console.error('Notification/Crashlytics setup failed:', error);
            }
        };

        init();
        const cleanup = setupNotificationListeners();
        return () => cleanup?.();
    }, [isReady]);

    const onLayoutRootView = useCallback(async () => {
        if (isReady && !initializing) {
            await SplashScreen.hideAsync();
        }
    }, [isReady, initializing]);

    if (!isReady || initializing) {
        return null;
    }

    if (!isAuthenticated) {
        return (
            <Provider store={store}>
                <View style={{ flex: 1, backgroundColor: Theme.colors.background }} onLayout={onLayoutRootView}>
                    <AtmosphericBackground />
                    <AuthGate />
                </View>
            </Provider>
        );
    }

    return (
        <Provider store={store}>
            <View style={{ flex: 1, backgroundColor: Theme.colors.background }} onLayout={onLayoutRootView}>
                <StatusBar style="light" />
                <AtmosphericBackground />
                <Stack screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Theme.colors.background }
                }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen 
                        name="opportunity/[symbol]" 
                        options={{ 
                            presentation: 'modal',
                            headerShown: true,
                            headerTitle: 'Opportunity',
                            headerStyle: { backgroundColor: Theme.colors.background },
                            headerTintColor: Theme.colors.text,
                        }} 
                    />
                </Stack>
            </View>
        </Provider>
    );
}
