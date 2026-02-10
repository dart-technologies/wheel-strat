import { View, Text, Modal, Pressable, StyleSheet, Dimensions, ScrollView, Image } from "react-native";
import { BlurView } from "expo-blur";
import { Theme } from "../constants/theme";
import IntroCarousel from "./IntroCarousel";
import GlassCard from "./GlassCard";

interface EducationModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function EducationModal({ visible, onClose }: EducationModalProps) {
    const { width } = Dimensions.get('window');
    const modalPadding = Theme.spacing.xl;
    const overlayPadding = Theme.spacing.lg;
    // Available width for carousel = ScreenWidth - (OverlayPadding * 2) - (ModalPadding * 2)
    const availableWidth = width - (overlayPadding * 2) - (modalPadding * 2);

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <BlurView intensity={Theme.blur.strong} style={StyleSheet.absoluteFill} tint="dark" />
                <GlassCard style={styles.modal} contentStyle={styles.modalContent} blurIntensity={Theme.blur.medium}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.header}>
                            <Image 
                                source={require('../assets/images/icon.png')} 
                                style={styles.logo}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>Wheel Strat</Text>
                            {/* <Text style={styles.subtitle}>Overview</Text> */}
                        </View>

                        <View style={styles.carouselWrapper}>
                            <IntroCarousel parentWidth={availableWidth} />
                        </View>

                        <Pressable
                            onPress={onClose}
                            style={styles.button}
                            testID="dismiss-onboarding"
                        >
                            <Text style={styles.buttonText}>{"Let's Wheel 🛞"}</Text>
                        </Pressable>
                    </ScrollView>
                </GlassCard>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Theme.spacing.lg,
    },
    modal: {
        width: '100%',
        maxHeight: '85%',
        borderRadius: Theme.borderRadius.xxl,
        overflow: 'hidden', // Ensure scrolling content doesn't bleed
    },
    modalContent: {
        padding: 0, // Remove padding from wrapper, move to ScrollView container
        width: '100%',
    },
    scrollContainer: {
        padding: Theme.spacing.xl,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: Theme.spacing.xl,
    },
    logo: {
        width: Theme.layout.logoSize,
        height: Theme.layout.logoSize,
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
    },
    title: {
        fontSize: Theme.typography.sizes.xxl,
        fontWeight: 'bold',
        color: Theme.colors.white,
        textAlign: 'center',
    },
    subtitle: {
        color: Theme.colors.textMuted,
        fontSize: Theme.typography.sizes.md,
        marginTop: 4,
        textAlign: 'center',
    },
    carouselWrapper: {
        width: '100%',
        marginVertical: Theme.spacing.md,
    },
    button: {
        backgroundColor: Theme.colors.primary,
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.xl,
        borderRadius: Theme.borderRadius.lg,
        width: '100%',
        alignItems: 'center',
        marginTop: Theme.spacing.lg,
    },
    buttonText: {
        color: Theme.colors.white,
        fontWeight: 'bold',
        fontSize: Theme.typography.sizes.lg,
    }
});
