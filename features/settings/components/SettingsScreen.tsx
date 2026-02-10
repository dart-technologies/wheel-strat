import { Ionicons } from "@expo/vector-icons";
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import ScreenLayout from "@/components/ScreenLayout";
import EducationModal from "@/components/EducationModal";
import GlassCard from "@/components/GlassCard";
import SegmentedControl from "@/components/SegmentedControl";
import { Theme } from "@/constants/theme";
import { useDteWindow, useRiskProfile, useTraderLevel } from "@/features/settings/hooks";
import { RISK_TARGET_WIN_PROB } from "@/utils/risk";
import { DTE_WINDOW_OPTIONS, TRADER_LEVELS, getImpliedExpirationDate, getDteWindowRange } from "@/utils/settings";
import { useAuth } from "@/hooks/useAuth";
import { scheduleTestNotification } from "@/services/notifications";

export default function SettingsScreen() {
    const [notifications, setNotifications] = useState(true);
    const [showEducation, setShowEducation] = useState(false);
    const insets = useSafeAreaInsets();
    const { currentRisk, setRiskLevel } = useRiskProfile();
    const { currentTraderLevel, setTraderLevel } = useTraderLevel();
    const { currentDteWindow, setDteWindow } = useDteWindow();
    const { user, signOut } = useAuth();

    const riskLevels: ('Conservative' | 'Moderate' | 'Aggressive')[] = ['Conservative', 'Moderate', 'Aggressive'];
    const riskDetails = {
        Aggressive: `${RISK_TARGET_WIN_PROB.Aggressive}%`,
        Moderate: `${RISK_TARGET_WIN_PROB.Moderate}%`,
        Conservative: `${RISK_TARGET_WIN_PROB.Conservative}%`
    };
    const riskIndex = Math.max(0, riskLevels.indexOf(currentRisk));
    const traderIndex = Math.max(0, TRADER_LEVELS.indexOf(currentTraderLevel));
    const dteIndex = Math.max(
        0,
        DTE_WINDOW_OPTIONS.findIndex((option) => option.value === currentDteWindow)
    );
    const impliedExpirationDate = getImpliedExpirationDate(currentDteWindow);
    const impliedExpirationLabel = impliedExpirationDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const dteRange = getDteWindowRange(currentDteWindow);
    const dteLabels = useMemo(() => DTE_WINDOW_OPTIONS.map((option) => `${option.weeks}W`), []);
    const accountLabel = user ? 'Logged In' : 'Guest';
    const accountDetail = user?.displayName || user?.email || 'Guest mode';
    const accountActionLabel = user ? 'Log Out' : 'Log In';
    const contentPaddingBottom = insets.bottom + Theme.spacing.xxl;

    return (
        <ScreenLayout title="Settings">
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentPaddingBottom }]}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Profile</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.row}>
                        <View style={styles.rowInfo}>
                            {user?.photoURL ? (
                                <Image source={{ uri: user.photoURL }} style={styles.avatar} contentFit="cover" />
                            ) : (
                                <View style={styles.avatar}>
                                    <Ionicons name={user ? "person" : "person-outline"} size={18} color={Theme.colors.text} />
                                </View>
                            )}
                            <View>
                                <Text style={styles.rowLabel} testID="account-label">{accountLabel}</Text>
                                <Text style={styles.rowHint} testID="account-detail">{accountDetail}</Text>
                            </View>
                        </View>
                        <Pressable
                            style={styles.accountAction}
                            testID="account-action"
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                signOut();
                            }}
                        >
                            <Text style={styles.accountActionText}>{accountActionLabel}</Text>
                            <Ionicons
                                name={user ? "log-out-outline" : "log-in-outline"}
                                size={16}
                                color={Theme.colors.primary}
                            />
                        </Pressable>
                    </View>
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Subscription</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.row}>
                        <View style={styles.rowInfo}>
                            <Ionicons name="card-outline" size={24} color={Theme.colors.text} />
                            <View>
                                <Text style={styles.rowLabel}>Plan</Text>
                                {/* <Text style={styles.rowHint}>Starter access</Text> */}
                            </View>
                        </View>
                        <View style={styles.betaPill}>
                            <Text style={styles.betaPillText}>BETA</Text>
                        </View>
                    </View>
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Education</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <Pressable
                        style={styles.row}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowEducation(true);
                        }}
                    >
                        <View style={styles.rowInfo}>
                            <Ionicons name="book-outline" size={24} color={Theme.colors.text} />
                            <Text style={styles.rowLabel}>Wheel Strategy Guide</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
                    </Pressable>
                </GlassCard>

                <EducationModal
                    visible={showEducation}
                    onClose={() => setShowEducation(false)}
                />

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Risk Profile</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.riskHeader}>
                        <Ionicons name="shield-outline" size={24} color={Theme.colors.text} />
                        <Text style={styles.rowLabel}>Target Win Probability</Text>
                        <Text style={styles.riskBadge}>{riskDetails[currentRisk as keyof typeof riskDetails]}</Text>
                    </View>

                    <SegmentedControl
                        options={riskLevels}
                        selectedIndex={riskIndex}
                        onChange={(index) => {
                            const next = riskLevels[index];
                            if (next) {
                                Haptics.selectionAsync();
                                setRiskLevel(next);
                            }
                        }}
                        style={styles.segmentControl}
                    />
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Trader Level</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.riskHeader}>
                        <Ionicons name="sparkles-outline" size={24} color={Theme.colors.text} />
                        <Text style={styles.rowLabel}>AI Analysis Tone</Text>
                        <Text style={styles.riskBadge}>{currentTraderLevel}</Text>
                    </View>
                    {/* <Text style={styles.settingDescription}>
                        Adjusts how detailed the AI analysis feels.
                    </Text> */}
                    <SegmentedControl
                        options={TRADER_LEVELS}
                        selectedIndex={traderIndex}
                        onChange={(index) => {
                            const next = TRADER_LEVELS[index];
                            if (next) {
                                Haptics.selectionAsync();
                                setTraderLevel(next);
                            }
                        }}
                        style={styles.segmentControl}
                    />
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>DTE Window</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.riskHeader}>
                        <Ionicons name="calendar-outline" size={24} color={Theme.colors.text} />
                        <Text style={styles.rowLabel}>Target Horizon</Text>
                        <Text style={styles.riskBadge}>
                            {impliedExpirationLabel}
                        </Text>
                    </View>
                    <Text style={styles.settingDescription}>
                        Filter scans targeting {dteRange.minDays}–{dteRange.maxDays} days to expiration.
                    </Text>
                    <SegmentedControl
                        options={dteLabels}
                        selectedIndex={dteIndex}
                        onChange={(index) => {
                            const next = DTE_WINDOW_OPTIONS[index];
                            if (next) {
                                Haptics.selectionAsync();
                                setDteWindow(next.value);
                            }
                        }}
                        style={styles.segmentControl}
                    />
                </GlassCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                </View>

                <GlassCard style={styles.card} contentStyle={styles.cardContent} blurIntensity={Theme.blur.medium}>
                    <View style={styles.row}>
                        <View style={styles.rowInfo}>
                            <Ionicons name="notifications-outline" size={24} color={Theme.colors.text} />
                            <Text style={styles.rowLabel}>Push Notifications</Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: Theme.colors.toggleTrackOff, true: Theme.colors.primary }}
                            thumbColor={Theme.colors.white}
                        />
                    </View>
                    
                    <View style={styles.divider} />
                    
                    <Pressable
                        style={styles.testButton}
                        onPress={async () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            await scheduleTestNotification();
                        }}
                    >
                        <Ionicons name="flask-outline" size={20} color={Theme.colors.primary} />
                        <Text style={styles.testButtonText}>Test Alert</Text>
                    </Pressable>
                </GlassCard>

                <View style={styles.footer}>
                    <Image
                        source={require('@/assets/images/icon.png')}
                        style={styles.logo}
                        contentFit="contain"
                    />
                    <Text style={styles.version}>v{Constants.expoConfig?.version}</Text>
                </View>
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 0,
    },
    sectionHeader: {
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.sm,
        marginTop: Theme.spacing.md,
    },
    sectionTitle: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        marginHorizontal: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.xl,
        marginBottom: Theme.spacing.xs,
    },
    cardContent: {
        padding: Theme.spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Theme.spacing.md_inner,
    },
    rowInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.layout.elementGap,
    },
    rowLabel: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.primary,
    },
    divider: {
        height: 1,
        backgroundColor: Theme.colors.glassBorder,
        marginVertical: Theme.spacing.xs,
    },
    footer: {
        alignItems: 'center',
        marginTop: Theme.spacing.lg,
        marginBottom: Theme.spacing.lg,
    },
    logo: {
        width: 48,
        height: 48,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.sm,
        opacity: Theme.opacity.visible,
    },
    version: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.semibold,
    },
    riskHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
        gap: Theme.layout.elementGap,
    },
    riskBadge: {
        marginLeft: 'auto',
        fontSize: Theme.typography.sizes.sm,
        fontWeight: Theme.typography.weights.bold,
        color: Theme.colors.primary,
        backgroundColor: Theme.colors.activeConfig,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.sm_inner,
    },
    settingDescription: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        marginBottom: Theme.spacing.sm,
    },
    settingMeta: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        marginBottom: Theme.spacing.sm,
    },
    segmentControl: {
        width: '100%',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: Theme.borderRadius.lg_plus,
        backgroundColor: Theme.colors.glass,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
    },
    rowHint: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.xs,
        marginTop: 2,
    },
    betaPill: {
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.activeConfigBorder,
        backgroundColor: Theme.colors.activeConfig,
    },
    betaPillText: {
        color: Theme.colors.primary,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
        letterSpacing: 1,
    },
    accountAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 6,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        borderColor: Theme.colors.activeConfigBorder,
        backgroundColor: Theme.colors.activeConfig,
    },
    accountActionText: {
        color: Theme.colors.primary,
        fontSize: Theme.typography.sizes.xs,
        fontWeight: Theme.typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        paddingVertical: Theme.spacing.md_inner,
    },
    testButtonText: {
        color: Theme.colors.primary,
        fontSize: Theme.typography.sizes.md,
        fontWeight: Theme.typography.weights.semibold,
    },
});
