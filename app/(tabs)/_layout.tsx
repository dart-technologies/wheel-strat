import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { View, StyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname, Slot } from 'expo-router';
import { Theme } from '@/constants/theme';
import BridgeStatus from '@/components/BridgeStatus';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DevClient from 'expo-dev-client';
import Constants from 'expo-constants';

export default function TabLayout() {
    const { width } = useWindowDimensions();
    const isIPad = width > 768;
    const router = useRouter();
    const pathname = usePathname();

    React.useEffect(() => {
        // Programmatic closure of the dev menu in Detox environment
        if (Constants.expoConfig?.extra?.env?.DETOX_TESTING === 'true') {
            DevClient.closeMenu();
        }
    }, []);

    if (isIPad) {
        return (
            <View style={styles.ipadContainer}>
                {/* Fixed Sidebar */}
                <SafeAreaView style={styles.sidebar} edges={['left', 'top', 'bottom']}>
                    <View style={styles.sidebarHeader}>
                        <Image
                            source={require('@/assets/images/icon.png')}
                            style={styles.logoImage}
                            contentFit="contain"
                        />
                        <Text style={styles.sidebarBrand}>Wheel Strat</Text>
                    </View>

                    <View style={styles.navGroup}>
                        <SidebarItem 
                            label="Dashboard" 
                            icon="grid-outline" 
                            activeIcon="grid"
                            isActive={pathname === '/'} 
                            onPress={() => router.push('/')} 
                            testID="tab-dashboard"
                        />
                        <SidebarItem 
                            label="Strategies" 
                            icon="telescope-outline" 
                            activeIcon="telescope"
                            isActive={pathname === '/strategies'} 
                            onPress={() => router.push('/strategies')} 
                            testID="tab-strategies"
                        />
                        <SidebarItem 
                            label="Journal" 
                            icon="book-outline" 
                            activeIcon="book"
                            isActive={pathname === '/journal'} 
                            onPress={() => router.push('/journal')} 
                            testID="tab-journal"
                        />
                        <SidebarItem 
                            label="Leaderboard" 
                            icon="trophy-outline" 
                            activeIcon="trophy"
                            isActive={pathname === '/leaderboard'} 
                            onPress={() => router.push('/leaderboard')} 
                            testID="tab-leaderboard"
                        />
                        <SidebarItem 
                            label="Settings" 
                            icon="settings-outline" 
                            activeIcon="settings"
                            isActive={pathname === '/settings'} 
                            onPress={() => router.push('/settings')} 
                            testID="tab-settings"
                        />
                    </View>

                    <View style={styles.sidebarFooter}>
                        <BridgeStatus />
                    </View>
                </SafeAreaView>

                {/* Main Content Area */}
                <View style={styles.mainContent}>
                    <Slot />
                </View>
            </View>
        );
    }

    return (
        <NativeTabs
            tintColor={Theme.colors.primary}
            iconColor={{ default: Theme.colors.textMuted, selected: Theme.colors.primary }}
            labelStyle={{
                default: {
                    fontSize: 10,
                    fontWeight: '600',
                    color: Theme.colors.textMuted
                },
                selected: {
                    fontSize: 10,
                    fontWeight: '700',
                    color: Theme.colors.text
                }
            }}
            backgroundColor={Theme.colors.background}
            blurEffect="systemChromeMaterialDark"
            disableTransparentOnScrollEdge
        >
            {/* @ts-ignore - testID is not in the type definition but used for E2E */}
            <NativeTabs.Trigger name="index" testID="tab-dashboard">
                <Icon src={<VectorIcon family={Ionicons} name="grid-outline" />} />
                <Label>Dashboard</Label>
            </NativeTabs.Trigger>
            {/* @ts-ignore */}
            <NativeTabs.Trigger name="strategies" testID="tab-strategies">
                <Icon src={<VectorIcon family={Ionicons} name="telescope-outline" />} />
                <Label>Strategies</Label>
            </NativeTabs.Trigger>
            {/* @ts-ignore */}
            <NativeTabs.Trigger name="journal" testID="tab-journal">
                <Icon src={<VectorIcon family={Ionicons} name="book-outline" />} />
                <Label>Journal</Label>
            </NativeTabs.Trigger>
            {/* @ts-ignore */}
            <NativeTabs.Trigger name="leaderboard" testID="tab-leaderboard">
                <Icon src={<VectorIcon family={Ionicons} name="trophy-outline" />} />
                <Label>Leaderboard</Label>
            </NativeTabs.Trigger>
            {/* @ts-ignore */}
            <NativeTabs.Trigger name="settings" testID="tab-settings">
                <Icon src={<VectorIcon family={Ionicons} name="settings-outline" />} />
                <Label>Settings</Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}

function SidebarItem({ label, icon, activeIcon, isActive, onPress, testID }: any) {
    return (
        <Pressable 
            onPress={() => {
                Haptics.selectionAsync();
                onPress();
            }} 
            style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
            testID={testID}
        >
            <Ionicons 
                name={isActive ? activeIcon : icon} 
                size={22} 
                color={isActive ? Theme.colors.primary : Theme.colors.textMuted} 
            />
            <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    ipadContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: Theme.colors.background,
    },
    sidebar: {
        width: 240,
        backgroundColor: Theme.colors.surface,
        borderRightWidth: 1,
        borderRightColor: Theme.colors.glassBorder,
        paddingHorizontal: Theme.spacing.md,
    },
    sidebarHeader: {
        paddingVertical: Theme.spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    logoImage: {
        width: 48,
        height: 48,
    },
    sidebarBrand: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.extraBold,
    },
    navGroup: {
        flex: 1,
        gap: Theme.spacing.xs,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    sidebarItemActive: {
        backgroundColor: Theme.colors.activeConfig,
    },
    sidebarLabel: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
    },
    sidebarLabelActive: {
        color: Theme.colors.text,
    },
    sidebarFooter: {
        paddingVertical: Theme.spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.glassBorder,
    },
    mainContent: {
        flex: 1,
    }
});
