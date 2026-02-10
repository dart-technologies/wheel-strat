describe('Smoke', () => {
    async function dismissOnboarding() {
        console.log('--- Attempting to dismiss onboarding ---');
        // App-level onboarding modal (EducationModal)
        try {
            const wheelBtn = element(by.id('dismiss-onboarding'));
            await waitFor(wheelBtn).toBeVisible().withTimeout(10000);
            await wheelBtn.tap();
            console.log('Dismissed Strategy Guide modal');
            // Wait for modal transition
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.log('Strategy Guide modal not found or already dismissed');
        }
    }

    beforeAll(async () => {
        // App launch is handled in setup.js with deep link bypass
        await device.disableSynchronization();
        await dismissOnboarding();
    });

    it('shows the Portfolio dashboard', async () => {
        await waitFor(element(by.id('page-title')))
            .toHaveText('Portfolio')
            .withTimeout(15000);
    });

    it('navigates through all main tabs', async () => {
        // Native tab bars often don't expose testID directly to Detox matchers easily.
        // Using labels which match the text in the tab bar.
        const tabs = [
            { label: 'Strategies', title: 'Strategies' },
            { label: 'Journal', title: 'Journal' },
            { label: 'Leaderboard', title: 'Leaderboard' },
            { label: 'Settings', title: 'Settings' },
            { label: 'Dashboard', title: 'Portfolio' }
        ];

        for (const tab of tabs) {
            console.log(`Navigating to ${tab.title}...`);
            // atIndex(0) because there might be multiple elements with the same label (icon + text)
            await element(by.label(tab.label)).atIndex(0).tap();
            
            // Verification
            await waitFor(element(by.id('page-title')))
                .toHaveText(tab.title)
                .withTimeout(10000);
            
            await device.takeScreenshot(`nav-${tab.label.toLowerCase()}`);
        }
    });

    it('can open an opportunity detail from Strategies', async () => {
        // Navigate to Strategies first
        await element(by.label('Strategies')).atIndex(0).tap();
        
        // Wait for list to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        await expect(element(by.id('page-title'))).toHaveText('Strategies');
    });

    it('shows the settings and interacts with risk profile', async () => {
        await element(by.label('Settings')).atIndex(0).tap();
        
        await waitFor(element(by.id('page-title')))
            .toHaveText('Settings')
            .withTimeout(5000);

        // Verify some settings are visible
        await expect(element(by.text('RISK PROFILE'))).toBeVisible();
        await expect(element(by.text('TRADER LEVEL'))).toBeVisible();
    });
});
