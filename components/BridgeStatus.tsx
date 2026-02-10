import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Modal, StyleSheet, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useBridgeHealth } from '@/hooks/useBridgeHealth';
import { Theme } from '@/constants/theme';
import { formatTimeSince } from '@/utils/time';
import { getIbkrConfig } from '@wheel-strat/shared';
import GlassCard from '@/components/GlassCard';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    cancelAnimation,
    Easing
} from 'react-native-reanimated';

const BridgeStatus = memo(() => {
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const opacity = useSharedValue(1);
    const refreshSpin = useSharedValue(0);
    const ibkrConfig = useMemo(() => getIbkrConfig(), []);
    const { status, latency, healthSnapshot, lastCheckedAt, refresh } = useBridgeHealth();

    useEffect(() => {
        if (status === 'checking') {
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.4, { duration: 600 }),
                    withTiming(1, { duration: 600 })
                ),
                -1,
                true
            );
        } else {
            cancelAnimation(opacity);
            opacity.value = withTiming(1, { duration: 200 });
        }
        return () => {
            cancelAnimation(opacity);
        };
    }, [opacity, status]);

    useEffect(() => {
        if (status === 'checking') {
            refreshSpin.value = withRepeat(
                withTiming(1, { duration: 900, easing: Easing.linear }),
                -1,
                false
            );
        } else {
            cancelAnimation(refreshSpin);
            refreshSpin.value = withTiming(0, { duration: 200 });
        }
        return () => {
            cancelAnimation(refreshSpin);
        };
    }, [refreshSpin, status]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowDiagnostics(true);
    };
    const handleRefresh = useCallback(async () => {
        const next = await refresh(true);
        if (next.status === 'online') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    }, [refresh]);

    const getStatusColor = () => {
        switch (status) {
            case 'online': return Theme.colors.success;
            case 'no-ib': return Theme.colors.error;
            case 'offline': return Theme.colors.error;
            case 'checking': return Theme.colors.warning;
            default: return Theme.colors.textMuted;
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'online': return 'link';
            case 'checking': return 'help-circle';
            default: return 'link-outline';
        }
    };

    const getStatusText = () => {
        if (status === 'checking') return 'CONNECTING';
        if (status === 'online') return ''; // Hide text when connected to save space
        return 'OFFLINE';
    };

    const animatedDotStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));
    const refreshSpinStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${refreshSpin.value * 360}deg` }],
    }));

    const lastCheckedLabel = lastCheckedAt
        ? formatTimeSince(new Date(lastCheckedAt))
        : 'Never';
    
    const statusPillLabel = status === 'online'
        ? 'CONNECTED'
        : status === 'checking'
            ? 'CONNECTING'
            : 'OFFLINE';

    const statusPillBg = status === 'online'
        ? Theme.colors.successWash
        : status === 'checking'
            ? Theme.colors.warningWash
            : Theme.colors.errorWash;
    const statusPillBorder = getStatusColor();

    const gatewayPillLabel = typeof healthSnapshot?.connected === 'boolean'
        ? (healthSnapshot.connected ? 'CONNECTED' : 'OFFLINE')
        : 'UNKNOWN';
    const gatewayColor = typeof healthSnapshot?.connected === 'boolean'
        ? (healthSnapshot.connected ? Theme.colors.success : Theme.colors.error)
        : Theme.colors.textMuted;
    const gatewayPillBg = typeof healthSnapshot?.connected === 'boolean'
        ? (healthSnapshot.connected ? Theme.colors.successWash : Theme.colors.errorWash)
        : Theme.colors.glassSubtle;

    const bridgeStatusLabel = healthSnapshot?.status?.toUpperCase() ?? '--';
    const clientIdLabel = healthSnapshot?.clientId !== undefined ? String(healthSnapshot.clientId) : '--';
    const hostLabel = healthSnapshot?.host ?? '--';
    const portLabel = healthSnapshot?.port !== undefined ? String(healthSnapshot.port) : '--';
    const bridgeModeLabel = healthSnapshot?.tradingMode?.toUpperCase() ?? '--';

    const statusText = getStatusText();

    return (
        <>
            <Pressable
                onPress={handlePress}
                style={[styles.container, status === 'online' && styles.containerConnected]}
                testID="bridge-status-button"
            >
                <Animated.View style={animatedDotStyle}>
                    <Ionicons 
                        name={getStatusIcon() as any} 
                        size={14} 
                        color={getStatusColor()} 
                    />
                </Animated.View>
                {statusText !== '' && (
                    <Text style={[styles.label, { color: getStatusColor() }]}>
                        {statusText}
                    </Text>
                )}
            </Pressable>

            <Modal
                visible={showDiagnostics}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDiagnostics(false)}
            >
                <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom']}>
                    <BlurView intensity={Theme.blur.strong} style={StyleSheet.absoluteFill} tint="dark" />
                    <GlassCard style={styles.modalCard} contentStyle={styles.modalContent} blurIntensity={Theme.blur.medium}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>System Diagnostics</Text>
                            <Pressable onPress={() => setShowDiagnostics(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={16} color={Theme.colors.primary} />
                            </Pressable>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Bridge Node</Text>
                                <View style={[styles.sectionPill, { backgroundColor: statusPillBg, borderColor: statusPillBorder }]}>
                                    <Ionicons name={getStatusIcon() as any} size={12} color={statusPillBorder} />
                                    <Text style={[styles.sectionPillText, { color: statusPillBorder }]}>
                                        {statusPillLabel}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Runtime Status</Text>
                                <Text style={styles.modalValue}>{bridgeStatusLabel}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Bridge Mode</Text>
                                <Text style={styles.modalValue}>{bridgeModeLabel}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Endpoint</Text>
                                <Text style={styles.modalValue} numberOfLines={1} ellipsizeMode="middle">{ibkrConfig.bridgeUrl}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Latency</Text>
                                <Text style={styles.modalValue}>{latency ? `${latency}ms` : '--'}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Heartbeat</Text>
                                <Text style={styles.modalValue}>{lastCheckedLabel}</Text>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>IBKR Gateway</Text>
                                <View style={[styles.sectionPill, { backgroundColor: gatewayPillBg, borderColor: gatewayColor }]}>
                                    <Ionicons name={gatewayPillLabel === 'CONNECTED' ? 'link' : 'link-outline'} size={12} color={gatewayColor} />
                                    <Text style={[styles.sectionPillText, { color: gatewayColor }]}>
                                        {gatewayPillLabel}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Client Identifier</Text>
                                <Text style={styles.modalValue}>{clientIdLabel}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Gateway Host</Text>
                                <Text style={styles.modalValue}>{hostLabel}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Gateway Port</Text>
                                <Text style={styles.modalValue}>{portLabel}</Text>
                            </View>
                        </View>

                        {healthSnapshot?.error && (
                            <View style={[styles.section, styles.errorSection]}>
                                <Text style={styles.errorTitle}>System Error</Text>
                                <Text style={styles.errorText}>{healthSnapshot.error}</Text>
                            </View>
                        )}

                        <Pressable
                            onPress={handleRefresh}
                            style={styles.refreshButton}
                        >
                            <View style={styles.refreshContent}>
                                <Animated.View style={[styles.refreshIcon, refreshSpinStyle]}>
                                    <Ionicons name="refresh" size={16} color={Theme.colors.black} />
                                </Animated.View>
                                <Text style={styles.refreshText}>Run Diagnostics</Text>
                            </View>
                        </Pressable>
                    </GlassCard>
                </SafeAreaView>
            </Modal>
        </>
    );
});

BridgeStatus.displayName = 'BridgeStatus';

export default BridgeStatus;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: Theme.borderRadius.full,
        backgroundColor: Theme.colors.glassSubtle,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    containerConnected: {
        paddingHorizontal: 6, // Circular for icon-only mode
    },
    label: {
        fontSize: Theme.typography.sizes.xxs, // Consistent all-caps size
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    section: {
        marginTop: Theme.spacing.md,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        backgroundColor: Theme.colors.glassSubtle,
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    errorSection: {
        backgroundColor: Theme.colors.errorWash,
        borderColor: Theme.colors.error,
    },
    errorTitle: {
        color: Theme.colors.error,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Theme.spacing.xs,
    },
    errorText: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.xs,
        lineHeight: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Theme.spacing.sm,
    },
    sectionTitle: {
        color: Theme.colors.textSubtle,
        fontSize: Theme.typography.sizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sectionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.md_inner,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
    },
    sectionDot: {
        width: 6,
        height: 6,
        borderRadius: Theme.borderRadius.xs_inner,
    },
    sectionPillText: {
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Theme.spacing.lg,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: Theme.borderRadius.xl,
    },
    modalContent: {
        padding: Theme.spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    modalTitle: {
        fontSize: Theme.typography.sizes.lg,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.text,
    },
    closeButton: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        backgroundColor: Theme.colors.activeConfig,
        borderWidth: 1,
        borderColor: Theme.colors.activeConfigBorder,
    },
    modalRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.sm,
    },
    modalLabel: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
        minWidth: 110,
        flexShrink: 0,
    },
    modalValue: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.sm,
        flex: 1,
        textAlign: 'right',
        flexShrink: 1,
    },
    refreshButton: {
        marginTop: Theme.spacing.md,
        backgroundColor: Theme.colors.primary,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        alignItems: 'center',
    },
    refreshContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    refreshIcon: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    refreshText: {
        color: Theme.colors.white,
        fontWeight: Theme.typography.weights.bold,
        fontSize: Theme.typography.sizes.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
