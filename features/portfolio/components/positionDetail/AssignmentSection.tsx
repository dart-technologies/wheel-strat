import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '@/components/GlassCard';
import RiskSpeedometer from '@/components/RiskSpeedometer';
import { Theme } from '@/constants/theme';
import { RiskLevel } from '@wheel-strat/shared';
import { styles } from './styles';

type AssignmentSectionProps = {
    delta?: number;
    riskLevel: RiskLevel;
};

export function AssignmentSection({ delta, riskLevel }: AssignmentSectionProps) {
    return (
        <GlassCard style={styles.sectionCard} blurIntensity={Theme.blur.medium}>
            <View style={styles.sectionHeader}>
                <Ionicons name="speedometer-outline" size={16} color={Theme.colors.primary} />
                <Text style={styles.sectionTitle}>Assignment Probability</Text>
            </View>
            <RiskSpeedometer delta={delta} riskLevel={riskLevel} />
        </GlassCard>
    );
}
