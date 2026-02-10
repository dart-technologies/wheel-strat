import { View, Text, StyleSheet } from "react-native";
import { Theme } from "../constants/theme";
import GlassCard from "./GlassCard";
import Carousel from 'react-native-reanimated-carousel';

interface IntroCarouselProps {
    parentWidth: number;
}

const SPACING = Theme.spacing.sm;

const SLIDES = [
    {
        title: "Risk-Free Paper Trading",
        desc: "Master the Wheel Strategy using paper money. Track Mag7 positions in real-time without risking your capital.",
        icon: "🎮"
    },
    {
        title: "Social Leaderboard",
        desc: "See what the community is trading. Compete on the leaderboard and learn from top yielders.",
        icon: "🏆"
    },
    {
        title: "The Wheel Strategy",
        desc: "A systematic way to generate income. Sell puts to enter, sell calls to exit, and collect premiums both ways.",
        icon: "🔄"
    },
    {
        title: "Smart Alerts",
        desc: "Real-time push notifications for high-probability opportunities and technical signals.",
        icon: "🔔"
    },
    {
        title: "Level Up Your Trading",
        desc: "Upgrade to Pro and Diamond agentic trading bot mode coming soon.",
        icon: "💎"
    }
];

export default function IntroCarousel({ parentWidth }: IntroCarouselProps) {

    return (
        <View style={styles.container}>
            <Carousel
                loop={false}
                width={parentWidth}
                height={220} // Fixed height match
                data={SLIDES}
                scrollAnimationDuration={1000}
                mode="parallax"
                modeConfig={{
                    parallaxScrollingScale: 0.9,
                    parallaxScrollingOffset: 40,
                }}
                renderItem={({ item }) => (
                    <View style={styles.cardWrapper}>
                        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
                            <Text style={styles.icon}>{item.icon}</Text>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.desc}>{item.desc}</Text>
                        </GlassCard>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Theme.spacing.md,
        alignItems: 'center',
    },
    cardWrapper: {
        flex: 1,
        paddingHorizontal: SPACING, // gap
    },
    card: {
        borderRadius: Theme.borderRadius.xl,
        height: '100%',
        borderWidth: 1,
        borderColor: Theme.colors.glassBorder,
        backgroundColor: Theme.colors.glassSubtle,
        overflow: 'hidden',
    },
    cardContent: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: Theme.spacing.lg,
        height: '100%',
    },
    icon: {
        fontSize: Theme.typography.sizes.display_plus,
        marginBottom: Theme.spacing.md,
    },
    title: {
        color: Theme.colors.text,
        fontSize: Theme.typography.sizes.lg,
        fontWeight: 'bold',
        marginBottom: Theme.spacing.sm,
        textAlign: 'center',
    },
    desc: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 20,
    }
});
