import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedLayout from './AnimatedLayout';
import PageHeader from './PageHeader';
import { Theme } from '@/constants/theme';

interface ScreenLayoutProps {
    title: string;
    subtitle?: string;
    subtitleElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    showBridgeStatus?: boolean;
    delay?: number;
    children: React.ReactNode;
    containerStyle?: ViewStyle;
    contentStyle?: ViewStyle;
    headerContainerStyle?: ViewStyle;
}

export default function ScreenLayout({
    title,
    subtitle,
    subtitleElement,
    rightElement,
    showBridgeStatus,
    delay = 0,
    children,
    containerStyle,
    contentStyle,
    headerContainerStyle,
}: ScreenLayoutProps) {
    return (
        <SafeAreaView style={[styles.container, containerStyle]} edges={['top', 'bottom']}>
            <AnimatedLayout delay={delay} style={styles.animated}>
                <View style={[styles.headerWrapper, headerContainerStyle]}>
                    <PageHeader
                        title={title}
                        subtitle={subtitle}
                        subtitleElement={subtitleElement}
                        rightElement={rightElement}
                        showBridgeStatus={showBridgeStatus}
                    />
                </View>
                <View style={[styles.content, contentStyle]}>
                    {children}
                </View>
            </AnimatedLayout>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    animated: {
        flex: 1,
    },
    headerWrapper: {
        width: '100%',
    },
    content: {
        flex: 1,
    },
});
