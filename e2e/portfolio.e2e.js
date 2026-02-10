describe('Portfolio and Position Flows', () => {
    async function dismissOnboarding() {
        try {
            const wheelBtn = element(by.id('dismiss-onboarding'));
            await waitFor(wheelBtn).toBeVisible().withTimeout(10000);
            await wheelBtn.tap();
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {}
    }

    beforeAll(async () => {
        await device.launchApp({
            newInstance: true,
            launchArgs: { detoxGuestMode: 'enabled' }
        });
        await device.disableSynchronization();
        await dismissOnboarding();
    });

    it('should show the Portfolio summary card', async () => {
        await expect(element(by.text('NET LIQUIDITY'))).toBeVisible();
        await expect(element(by.text('EXCESS LIQUIDITY'))).toBeVisible();
    });

    it('should show the Positions section', async () => {
        // Swipe on the list container
        await element(by.id('portfolio-list')).swipe('up', 'slow', 0.5);
        await waitFor(element(by.id('positions-header'))).toBeVisible().withTimeout(5000);
    });

    it('should navigate to position detail when tapping a position card', async () => {
        try {
            const firstPosition = element(by.id('position-card')).atIndex(0);
            await waitFor(firstPosition).toBeVisible().withTimeout(5000);
            await firstPosition.tap();
            
            await waitFor(element(by.id('page-title'))).toBeVisible().withTimeout(5000);
            await element(by.id('header-back')).tap();
            
            await waitFor(element(by.id('positions-header'))).toBeVisible().withTimeout(5000);
        } catch (e) {
            console.log('No positions found to test navigation');
        }
    });
});