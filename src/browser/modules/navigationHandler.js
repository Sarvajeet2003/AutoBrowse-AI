class NavigationHandler {
    constructor(controller) {
        this.controller = controller;
    }

    async navigate(url) {
        const page = await this.controller.getPage();
        // Add http:// prefix if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        try {
            // Set a longer timeout for navigation
            await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
            // Add a small delay after navigation to ensure page is fully loaded
            await this.controller.delay(1000);
            console.log(`Navigated to ${url}`);

            // Check for Amazon CAPTCHA if we're on Amazon
            if (url.includes('amazon')) {
                await this.controller.captchaHandler.handleAmazonCaptcha();
            }

            return true;
        } catch (error) {
            console.error(`Navigation error: ${error.message}`);
            return false;
        }
    }

    async waitForNavigation(timeout = 30000) {
        const page = await this.controller.getPage();
        try {
            await page.waitForNavigation({ timeout });
            console.log('Navigation completed');
            return true;
        } catch (error) {
            console.error(`Wait for navigation error: ${error.message}`);
            return false;
        }
    }
}

module.exports = NavigationHandler;