import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '@/components/GlassCard';
import PayoffGlyph from '@/components/PayoffGlyph';
import YieldMeta from '@/features/portfolio/components/YieldMeta';
import { Theme } from '@/constants/theme';
import { styles } from './styles';

export type WheelActionItem = {
    type: 'CC' | 'CSP';
    title: string;
    desc: string;
    icon: string;
    iconColor: string;
    yieldValue?: number;
    yield: string;
    winProb: string;
    winProbLabel: string;
    winProbIsTarget: boolean;
    strategy: string;
    strike: number;
    expiration: string;
    premium: number;
    premiumSource?: string;
    greeks: {
        delta?: number;
        gamma?: number;
        theta?: number;
        vega?: number;
    };
    isLive: boolean;
};

type FreshnessState = {
    isStale: boolean;
    ageLabel?: string | null;
};

type WheelActionsSectionProps = {
    actions: WheelActionItem[];
    quantity: number;
    marketOpen: boolean;
    freshness: FreshnessState;
    onReviewTrade: (actionType: 'CC' | 'CSP') => void;
};

export function WheelActionsSection({
    actions,
    quantity,
    marketOpen,
    freshness,
    onReviewTrade
}: WheelActionsSectionProps) {
    return (
        <>
            <Text style={styles.sectionTitle}>Wheel Actions</Text>

            {actions.map((action) => {
                if (action.type === 'CC' && quantity < 100) return null;
                const isDisabled = !action.isLive;

                const isActionStale = action.isLive && (!marketOpen || freshness.isStale);

                const ctaLabel = action.isLive
                    ? 'Review Trade'
                    : 'Live data unavailable';
                const ctaIcon = action.isLive ? 'arrow-forward' : 'alert-circle-outline';

                return (
                    <Animated.View
                        key={action.type}
                        layout={LinearTransition.duration(Theme.motion.duration.medium)}
                        entering={FadeIn}
                        exiting={FadeOut}
                    >
                        <Pressable
                            onPress={() => {
                                if (action.isLive) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onReviewTrade(action.type);
                                }
                            }}
                            disabled={isDisabled}
                        >
                            <GlassCard
                                style={[
                                    styles.actionCard,
                                    isDisabled && styles.actionCardDisabled,
                                ]}
                                contentStyle={styles.actionCardContent}
                                blurIntensity={Theme.blur.subtle}
                                isStale={isActionStale}
                            >
                                <View style={styles.actionTop}>
                                    <View style={[styles.actionIcon, { backgroundColor: action.iconColor + '15' }]}>
                                        <PayoffGlyph
                                            type={action.type === 'CC' ? 'cc' : 'csp'}
                                            size={24}
                                            color={action.iconColor}
                                        />
                                    </View>
                                    <View style={styles.actionTitleBlock}>
                                        <View style={styles.actionTitleRow}>
                                            <Text style={styles.actionTitle}>{action.title}</Text>
                                        </View>
                                        {isActionStale && (
                                            <Text style={styles.actionStaleText}>
                                                Updated {freshness.ageLabel || 'recently'}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={[
                                        styles.actionYieldPill,
                                        {
                                            backgroundColor: action.type === 'CC'
                                                ? Theme.colors.strategyCcWash
                                                : Theme.colors.strategyCspWash
                                        }
                                    ]}>
                                        {action.isLive ? (
                                            <YieldMeta
                                                yieldValue={action.yieldValue}
                                                premium={action.premium}
                                                strike={action.strike}
                                                premiumSource={action.premiumSource}
                                                accentColor={action.type === 'CC' ? Theme.colors.strategyCc : Theme.colors.strategyCsp}
                                                size="sm"
                                                style={styles.actionYieldMeta}
                                            />
                                        ) : (
                                            <Text style={[
                                                styles.actionYieldText,
                                                { color: action.type === 'CC' ? Theme.colors.strategyCc : Theme.colors.strategyCsp }
                                            ]}>
                                                Live data unavailable
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.actionFooter}>
                                    <View style={styles.actionMeta}>
                                        <View style={styles.metaItem}>
                                            <Ionicons name="shield-checkmark" size={12} color={Theme.colors.textMuted} />
                                            <Text style={[styles.metaText, action.winProbIsTarget && styles.metaTextItalic]}>
                                                {action.winProbLabel}
                                            </Text>
                                        </View>
                                        <View style={styles.metaItem}>
                                            <Ionicons name="calendar-outline" size={12} color={Theme.colors.textMuted} />
                                            <Text style={styles.metaText}>{action.expiration}</Text>
                                        </View>
                                    </View>
                                    <View style={[
                                        styles.actionCta,
                                        {
                                            backgroundColor: action.isLive
                                                ? (action.type === 'CC' ? Theme.colors.strategyCc : Theme.colors.strategyCsp)
                                                : Theme.colors.glassBorder
                                        },
                                        isDisabled && styles.actionCtaDisabled
                                    ]}>
                                        <Text style={[styles.actionCtaText, !action.isLive && styles.actionCtaTextMuted]}>
                                            {ctaLabel}
                                        </Text>
                                        <Ionicons name={ctaIcon} size={14} color={action.isLive ? Theme.colors.white : Theme.colors.textMuted} />
                                    </View>
                                </View>
                            </GlassCard>
                        </Pressable>
                    </Animated.View>
                );
            })}
        </>
    );
}
