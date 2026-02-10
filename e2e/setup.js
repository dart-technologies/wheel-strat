const { device } = require('detox');

beforeAll(async () => {
    await device.launchApp({
        permissions: { notifications: 'YES' },
        newInstance: true,
        launchArgs: {
            EX_DEV_LAUNCHER_BYPASS_SELECTION_VIEW: '1',
            detoxGuestMode: 'enabled',
        },
    });

    // Use the specially formatted deep link to force the Dev Client to load the bundle immediately.
    // The scheme "exp+wheel-strat" is the recommended way to bypass the launcher.
    // Appending disableOnboarding=1 to bypass the developer menu introduction.
    const metroUrl = encodeURIComponent('http://localhost:8081?disableOnboarding=1');
    await device.openURL({
        url: `exp+wheel-strat://expo-development-client/?url=${metroUrl}`,
    });

    // App is often busy loading Metro and showing onboarding modals
    await device.disableSynchronization();

    // Dismiss the "This is the developer menu" onboarding modal if it appears
    try {
        const continueBtn = element(by.text('Continue'));
        await waitFor(continueBtn).toBeVisible().withTimeout(15000);
        await continueBtn.tap();
        
        // Wait for modal animation to finish
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
        // Modal didn't appear or already dismissed
    }
});
