import { Pressable, Text, View } from 'react-native';
import GlassCard from '@/components/GlassCard';
import PayoffGlyph from '@/components/PayoffGlyph';
import { Theme } from '@/constants/theme';
import { formatCurrency, formatCompactCurrency } from '@/utils/format';
import type { OptionPosition } from '@wheel-strat/shared';
import { styles } from './styles';

type CurrentPositionsSectionProps = {
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    totalReturn: number;
    totalReturnPct: number;
    optionPositions: OptionPosition[];
    onCloseOption?: (option: OptionPosition) => void;
    onRollOption?: (option: OptionPosition) => void;
};

const formatExpiration = (value?: string) => {
    if (!value) return '--';
    const compact = value.replace(/-/g, '');
    if (compact.length === 8) {
        const year = compact.slice(0, 4);
        const month = compact.slice(4, 6);
        const day = compact.slice(6, 8);
        return `${month}/${day}/${year.slice(2)}`;
    }
    return value;
};

export function CurrentPositionsSection({
    symbol,
    quantity,
    avgCost,
    currentPrice,
    marketValue,
    totalReturn,
    totalReturnPct,
    optionPositions,
    onCloseOption,
    onRollOption
}: CurrentPositionsSectionProps) {
    const equityValue = marketValue;
    const equityPriceLabel = Number.isFinite(currentPrice) ? `$${currentPrice.toFixed(2)}` : '--';
    const avgCostLabel = Number.isFinite(avgCost) ? `$${avgCost.toFixed(2)}` : '--';
    const marketValueLabel = formatCompactCurrency(marketValue, 0);
    const hasReturnValue = Number.isFinite(totalReturn);
    const returnValueLabel = hasReturnValue ? formatCompactCurrency(Math.abs(totalReturn), 0) : '—';
    const hasReturnPct = Number.isFinite(totalReturnPct);
    const returnPctLabel = hasReturnPct ? `${totalReturnPct.toFixed(1)}%` : '—';
    const returnPrefix = totalReturn >= 0 ? '+' : '-';

    return (
        <GlassCard style={styles.sectionCard} contentStyle={styles.positionsContent} blurIntensity={Theme.blur.medium}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Current Positions</Text>
            </View>

            <View style={styles.statRow}>
                <View>
                    <Text style={styles.label}>Market Value</Text>
                    <Text style={styles.bigValue}>{marketValueLabel}</Text>
                    <Text style={styles.positionMeta}>
                        Return {hasReturnValue ? `${returnPrefix}${returnValueLabel}` : '—'}
                    </Text>
                </View>
                <View style={styles.badgeContainer}>
                    <View style={[styles.badge, totalReturn >= 0 ? styles.badgeSuccess : styles.badgeError]}>
                        <Text style={[styles.badgeText, totalReturn >= 0 ? styles.textSuccess : styles.textError]}>
                            {hasReturnPct ? `${totalReturn >= 0 ? '+' : ''}${returnPctLabel}` : '—'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.positionRow}>
                <View style={styles.positionLeft}>
                    <Text style={styles.positionTitle}>Equity</Text>
                    <Text style={styles.positionMeta}>{symbol} · {Math.round(quantity).toLocaleString()} sh</Text>
                </View>
                <View style={styles.positionRight}>
                    <Text style={styles.positionValue}>{formatCompactCurrency(equityValue, 0)}</Text>
                    <Text style={styles.positionMeta}>Avg {avgCostLabel} • {equityPriceLabel}</Text>
                </View>
            </View>

            {optionPositions.length === 0 ? (
                <Text style={styles.positionEmpty}>No options open for this symbol.</Text>
            ) : (
                optionPositions.map((option, index) => {
                    const right = (option.right || '').toUpperCase();
                    const isCall = right === 'C';
                    const isPut = right === 'P';
                    const quantityValue = Number(option.quantity) || 0;
                    const isShort = quantityValue < 0;
                    const showActions = (isCall || isPut) && isShort && (onCloseOption || onRollOption);
                    const sideLabel = quantityValue < 0 ? 'Short' : 'Long';
                    const typeLabel = isCall ? 'Call' : isPut ? 'Put' : 'Option';
                    const strikeLabel = typeof option.strike === 'number' ? formatCurrency(option.strike) : '--';
                    const expirationLabel = formatExpiration(option.expiration);
                    const priceValue = Number(option.currentPrice ?? option.averageCost);
                    const priceLabel = Number.isFinite(priceValue) ? formatCurrency(priceValue) : '--';
                    const deltaValue = Number((option as any).delta);
                    const assignmentProb = Number.isFinite(deltaValue)
                        ? Math.round(Math.min(1, Math.abs(deltaValue)) * 100)
                        : null;
                    const assignmentLabel = assignmentProb !== null ? `${assignmentProb}% Assign` : null;
                    const glyphType = isCall ? 'cc' : 'csp';
                    const glyphColor = isCall ? Theme.colors.strategyCc : Theme.colors.strategyCsp;

                    return (
                        <View key={`${option.localSymbol || option.conId || option.symbol}-${index}`} style={styles.optionRow}>
                            <View style={styles.optionLeft}>
                                <View style={[styles.optionGlyph, { backgroundColor: glyphColor + '20' }]}>
                                    <PayoffGlyph type={glyphType} size={14} color={glyphColor} />
                                </View>
                                <View>
                                    <Text style={styles.positionTitle}>{sideLabel} {typeLabel}</Text>
                                    <Text style={styles.positionMeta}>
                                        {strikeLabel} • {expirationLabel} • {Math.abs(quantityValue)}x
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.positionRight}>
                                <Text style={styles.positionValue}>{priceLabel}</Text>
                                {assignmentLabel && (
                                    <Text style={styles.positionMeta}>{assignmentLabel}</Text>
                                )}
                                {showActions && (
                                    <View style={styles.optionActions}>
                                        {onCloseOption && (
                                            <Pressable
                                                onPress={() => onCloseOption(option)}
                                                style={({ pressed }) => [
                                                    styles.optionActionButton,
                                                    styles.optionActionPrimary,
                                                    pressed && styles.optionActionPressed
                                                ]}
                                            >
                                                <Text style={styles.optionActionText}>Close</Text>
                                            </Pressable>
                                        )}
                                        {onRollOption && (
                                            <Pressable
                                                onPress={() => onRollOption(option)}
                                                style={({ pressed }) => [
                                                    styles.optionActionButton,
                                                    styles.optionActionSecondary,
                                                    pressed && styles.optionActionPressed
                                                ]}
                                            >
                                                <Text style={styles.optionActionText}>Roll</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })
            )}
        </GlassCard>
    );
}
