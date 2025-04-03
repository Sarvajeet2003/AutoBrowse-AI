class InteractionHandler {
    constructor(controller) {
        this.controller = controller;
    }

    async click(selector, options = {}) {
        const page = await this.controller.getPage();

        try {
            // Handle array of selectors
            if (Array.isArray(selector)) {
                // Try each selector in the array
                for (const singleSelector of selector) {
                    try {
                        await page.waitForSelector(singleSelector, { timeout: 5000 }); // Increased timeout
                        // Add a small delay before clicking to simulate human behavior
                        await this.controller.delay(Math.floor(Math.random() * 300) + 300); // Randomized delay for more human-like behavior
                        await page.click(singleSelector);
                        console.log(`Clicked on selector: ${singleSelector}`);
                        return true;
                    } catch (selectorError) {
                        // Continue to the next selector
                        console.log(`Selector ${singleSelector} not found for clicking, trying next...`);
                    }
                }

                // If we get here, none of the selectors worked
                console.error(`None of the provided selectors worked for clicking`);

                // Check if we should use a fallback method
                if (options.fallback === 'enterKey') {
                    try {
                        await page.keyboard.press('Enter');
                        console.log('Used fallback: Pressed Enter key');
                        await this.controller.delay(2000);
                        return true;
                    } catch (fallbackError) {
                        console.error(`Fallback method failed: ${fallbackError.message}`);
                    }
                }

                // Try common button selectors as a last resort
                return this.tryCommonButtonSelectors(page);
            }

            // Original code for string selector
            try {
                // Wait for selector with a reasonable timeout
                await page.waitForSelector(selector, { timeout: 10000 });
                // Add a small delay before clicking to simulate human behavior
                await this.controller.delay(500);
                await page.click(selector);
                // Add a small delay after clicking
                await this.controller.delay(500);
                console.log(`Clicked on ${selector}`);
                return true;
            } catch (error) {
                console.error(`Unexpected error during click operation: ${error.message}`);
                return false;
            }
        } catch (error) {
            console.error(`Unexpected error during click operation: ${error.message}`);
            return false;
        }
    }

    async type(selector, text) {
        const page = await this.controller.getPage();

        // Handle array of selectors
        if (Array.isArray(selector)) {
            // Try each selector in the array
            for (const singleSelector of selector) {
                try {
                    await page.waitForSelector(singleSelector, { timeout: 3000 });
                    const input = await page.$(singleSelector);
                    if (input) {
                        await input.fill(text, { delay: 100 });
                        console.log(`Typed "${text}" into selector: ${singleSelector}`);
                        
                        // For Google search, immediately press Enter after typing
                        if (page.url().includes('google') && 
                            (singleSelector.includes('search') || singleSelector.includes('q'))) {
                            await this.controller.delay(500);
                            await page.keyboard.press('Enter');
                            console.log('Automatically pressed Enter for Google search');
                            await this.controller.delay(2000);
                        }
                        
                        return true;
                    }
                } catch (selectorError) {
                    // Continue to the next selector
                    console.log(`Selector ${singleSelector} not found, trying next...`);
                }
            }

            // If we get here, none of the selectors worked
            console.error(`None of the provided selectors worked for typing`);
            return false;
        }

        try {
            await page.waitForSelector(selector, { timeout: 5000 });
            await page.fill(selector, text, { delay: 100 }); // Add delay between keystrokes for more human-like typing
            console.log(`Typed "${text}" into ${selector}`);
            return true;
        } catch (error) {
            console.error(`Type error on ${selector}: ${error.message}`);
            
            // Try to find the element and click it first
            try {
                console.log(`Trying to click the element first before typing`);
                await page.click(selector);
                await this.controller.delay(500);
                await page.fill(selector, text, { delay: 100 });
                console.log(`Successfully typed after clicking first`);
                return true;
            } catch (retryError) {
                console.error(`Retry also failed: ${retryError.message}`);
                return false;
            }
        }
    }

    // Helper method to try common button selectors
    async tryCommonButtonSelectors(page) {
        // Try common selectors based on context
        if (page.url().includes('google')) {
            try {
                // Updated Google search button selectors
                const searchButtons = [
                    'input[name="btnK"]',
                    'input[value="Google Search"]',
                    'button[aria-label="Google Search"]',
                    'button.gNO89b',
                    'input.gNO89b',
                    'input[type="search"]',
                    'button[type="search"]'
                ];

                for (const btnSelector of searchButtons) {
                    const button = await page.$(btnSelector);
                    if (button) {
                        await button.click();
                        console.log(`Clicked on alternative search button: ${btnSelector}`);
                        return true;
                    }
                }

                // Try pressing Enter key as a fallback
                await page.keyboard.press('Enter');
                console.log('Pressed Enter key to submit search');
                await this.controller.delay(2000); // Wait for search results to load
                return true;
            } catch (altError) {
                console.error(`Failed to click alternative search buttons: ${altError.message}`);
            }
        } else if (page.url().includes('youtube')) {
            try {
                const youtubeButtons = [
                    '#search-icon-legacy',
                    'button[aria-label="Search"]',
                    'button.ytd-searchbox'
                ];

                for (const btnSelector of youtubeButtons) {
                    try {
                        const button = await page.$(btnSelector);
                        if (button) {
                            await button.click();
                            console.log(`Clicked on YouTube button: ${btnSelector}`);
                            return true;
                        }
                    } catch (e) {
                        // Continue to next selector
                    }
                }

                // Try pressing Enter as fallback for YouTube
                await page.keyboard.press('Enter');
                console.log('Pressed Enter key for YouTube search');
                await this.controller.delay(2000);
                return true;
            } catch (ytError) {
                console.error(`Failed to click YouTube buttons: ${ytError.message}`);
            }
        }

        // Try to find any clickable element that looks like a result
        try {
            const resultSelectors = [
                'div.g a',
                'div.yuRUbf a',
                'h3.LC20lb',
                'div[data-sokoban-container] a',
                'div.tF2Cxc a',
                '.v5yQqb a',
                '.DKV0Md',
                '.v7W49e a',
                '.MjjYud a',
                'a.sVXRqc'
            ];

            // First try to wait for search results to fully load
            await this.controller.delay(2000);

            for (const resultSelector of resultSelectors) {
                try {
                    await page.waitForSelector(resultSelector, { timeout: 3000 });
                    const results = await page.$$(resultSelector);
                    if (results.length > 0) {
                        // Scroll to make the element visible
                        await results[0].scrollIntoViewIfNeeded();
                        await this.controller.delay(500);
                        await results[0].click();
                        console.log(`Clicked on alternative result: ${resultSelector}`);
                        return true;
                    }
                } catch (selectorError) {
                    // Continue to the next selector
                }
            }

            // Last resort: try to find any link that looks like a result
            const anyLink = await page.$('a[href^="http"]:not([href*="google"])');
            if (anyLink) {
                await anyLink.scrollIntoViewIfNeeded();
                await this.controller.delay(500);
                await anyLink.click();
                console.log('Clicked on a generic link that appears to be a search result');
                return true;
            }
        } catch (altError) {
            console.error(`Failed to click alternative results: ${altError.message}`);
        }

        return false;
    }
}

module.exports = InteractionHandler;