const { chromium } = require('playwright');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class BrowserController {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.usingNativeBrowser = false;
        this.proxyConfig = null;
        this.extensionPaths = [];
    }

    // Add the missing delay method
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async handleAmazonCaptcha() {
        const page = await this.getPage();
        try {
            // Check if we're on an Amazon CAPTCHA page - improved detection
            const captchaElements = [
                'input[name="field-keywords"]',
                'img[src*="captcha"]',
                'input.a-input-text',
                'form[action*="captcha"]',
                'div.a-box-inner:has-text("Type the characters")',
                'div:has-text("Enter the characters you see")'
            ];

            let isCaptchaPage = false;
            for (const selector of captchaElements) {
                try {
                    if (await page.$(selector)) {
                        isCaptchaPage = true;
                        break;
                    }
                } catch (e) {
                    // Continue checking other selectors
                }
            }

            // Also check page title and URL
            const pageTitle = await page.title();
            if (
                isCaptchaPage ||
                page.url().includes('captcha') ||
                pageTitle.includes('Robot') ||
                pageTitle.includes('CAPTCHA')
            ) {
                console.log('Amazon CAPTCHA detected, attempting to solve...');

                // Try to find the CAPTCHA input field
                const inputSelectors = [
                    'input[name="field-keywords"]',
                    'input.a-input-text',
                    'input[type="text"]'
                ];

                let captchaInput = null;
                for (const selector of inputSelectors) {
                    captchaInput = await page.$(selector);
                    if (captchaInput) break;
                }

                if (captchaInput) {
                    console.log('CAPTCHA detected - waiting for manual intervention');

                    // Pause for manual intervention (user can solve the CAPTCHA)
                    console.log('Please solve the CAPTCHA manually in the browser window');
                    await this.delay(30000); // Wait 30 seconds for manual solving

                    // Try to find and click the continue button
                    const buttonSelectors = [
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button.a-button-text',
                        'span.a-button-inner',
                        'button:has-text("Continue")',
                        'button:has-text("Submit")'
                    ];

                    for (const btnSelector of buttonSelectors) {
                        try {
                            const button = await page.$(btnSelector);
                            if (button) {
                                await button.click();
                                console.log('Clicked continue button after CAPTCHA');
                                await this.delay(3000);
                                return true;
                            }
                        } catch (e) {
                            // Continue trying other selectors
                        }
                    }
                }

                return false;
            }

            return false; // No CAPTCHA detected
        } catch (error) {
            console.error(`Error handling Amazon CAPTCHA: ${error.message}`);
            return false;
        }
    }

    async initialize(options = {}) {
        if (!this.browser) {
            try {
                // Check if we should use native browser
                if (options.useNativeBrowser) {
                    return await this.initializeNativeBrowser(options);
                }

                // Configure launch options with proxy if provided
                const launchOptions = {
                    headless: false,
                    args: [
                        '--disable-blink-features=AutomationControlled',
                        '--no-sandbox',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                };

                // Add proxy configuration if provided
                if (options.proxy) {
                    this.proxyConfig = options.proxy;
                    launchOptions.proxy = {
                        server: this.proxyConfig.server,
                        username: this.proxyConfig.username,
                        password: this.proxyConfig.password
                    };
                    console.log(`Using proxy: ${this.proxyConfig.server}`);
                }

                // Add extensions if provided
                if (options.extensions && Array.isArray(options.extensions) && options.extensions.length > 0) {
                    this.extensionPaths = options.extensions;
                    // Add extension paths to args
                    for (const extPath of this.extensionPaths) {
                        if (fs.existsSync(extPath)) {
                            launchOptions.args.push(`--disable-extensions-except=${extPath}`);
                            launchOptions.args.push(`--load-extension=${extPath}`);
                            console.log(`Loading extension from: ${extPath}`);
                        } else {
                            console.warn(`Extension path not found: ${extPath}`);
                        }
                    }
                }

                this.browser = await chromium.launch(launchOptions);

                // Create a context with more human-like characteristics
                const contextOptions = {
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport: { width: 1280, height: 800 },
                    hasTouch: false,
                    javaScriptEnabled: true,
                    locale: 'en-US',
                    timezoneId: 'America/Los_Angeles',
                    geolocation: { longitude: -122.33, latitude: 47.62 },
                    permissions: ['geolocation']
                };

                this.context = await this.browser.newContext(contextOptions);
                this.page = await this.context.newPage();

                // Modify navigator properties to avoid detection
                await this.page.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => false });
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
                    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                });

                console.log('Browser initialized with Playwright');
            } catch (error) {
                console.error(`Failed to initialize browser: ${error.message}`);
                // Try one more time with minimal settings
                try {
                    this.browser = await chromium.launch({ headless: false });
                    this.context = await this.browser.newContext();
                    this.page = await this.context.newPage();
                    console.log('Browser initialized with fallback settings');
                } catch (fallbackError) {
                    console.error(`Critical error: Could not initialize browser: ${fallbackError.message}`);
                    throw new Error('Browser initialization failed');
                }
            }
        }
        return this.page;
    }

    // New method to initialize native Chrome browser
    async initializeNativeBrowser(options = {}) {
        try {
            this.usingNativeBrowser = true;

            // Determine Chrome executable path based on OS
            let chromePath = '';
            if (process.platform === 'darwin') {
                chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else if (process.platform === 'win32') {
                chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            } else if (process.platform === 'linux') {
                chromePath = '/usr/bin/google-chrome';
            }

            if (!fs.existsSync(chromePath)) {
                throw new Error(`Chrome executable not found at ${chromePath}`);
            }

            // Create a temporary user data directory
            const userDataDir = path.join(os.tmpdir(), `chrome-automation-${Date.now()}`);
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }

            // Build Chrome command line arguments
            let args = [
                `--user-data-dir=${userDataDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--remote-debugging-port=9222' // Enable remote debugging
            ];

            // Add proxy if configured
            if (options.proxy) {
                this.proxyConfig = options.proxy;
                args.push(`--proxy-server=${this.proxyConfig.server}`);
                console.log(`Using proxy: ${this.proxyConfig.server}`);
            }

            // Add extensions if provided
            if (options.extensions && Array.isArray(options.extensions) && options.extensions.length > 0) {
                this.extensionPaths = options.extensions;
                const extensionArgs = this.extensionPaths.filter(fs.existsSync).join(',');
                if (extensionArgs) {
                    args.push(`--load-extension=${extensionArgs}`);
                    console.log(`Loading extensions: ${extensionArgs}`);
                }
            }

            // Launch Chrome with the specified arguments
            const chromeProcess = exec(`"${chromePath}" ${args.join(' ')}`);
            console.log(`Launched native Chrome browser with PID: ${chromeProcess.pid}`);

            // Wait for Chrome to start and connect to it via CDP
            await this.delay(3000);

            // Connect to the browser using Playwright's CDP connection
            this.browser = await chromium.connectOverCDP('http://localhost:9222');
            const contexts = this.browser.contexts();
            this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();

            const pages = await this.context.pages();
            this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

            console.log('Connected to native Chrome browser');
            return this.page;
        } catch (error) {
            console.error(`Failed to initialize native browser: ${error.message}`);
            this.usingNativeBrowser = false;

            // Fall back to regular Playwright browser
            console.log('Falling back to Playwright-managed browser');
            return this.initialize({...options, useNativeBrowser: false });
        }
    }

    async navigate(url) {
        const page = await this.getPage();
        // Add http:// prefix if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        try {
            // Set a longer timeout for navigation
            await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
            // Add a small delay after navigation to ensure page is fully loaded
            await this.delay(1000);
            console.log(`Navigated to ${url}`);

            // Check for Amazon CAPTCHA if we're on Amazon
            if (url.includes('amazon')) {
                await this.handleAmazonCaptcha();
            }

            return true;
        } catch (error) {
            console.error(`Navigation error: ${error.message}`);
            return false;
        }
    }

    async getPage() {
        if (!this.page) {
            await this.initialize();
        }
        return this.page;
    }

    async click(selector, options = {}) {
        const page = await this.getPage();

        try {
            // Handle array of selectors
            if (Array.isArray(selector)) {
                // Try each selector in the array
                for (const singleSelector of selector) {
                    try {
                        await page.waitForSelector(singleSelector, { timeout: 5000 }); // Increased timeout
                        // Add a small delay before clicking to simulate human behavior
                        await this.delay(Math.floor(Math.random() * 300) + 300); // Randomized delay for more human-like behavior
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
                        await this.delay(2000);
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
                await this.delay(500);
                await page.click(selector);
                // Add a small delay after clicking
                await this.delay(500);
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
                await this.delay(2000); // Wait for search results to load
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
                await this.delay(2000);
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
            await this.delay(2000);

            for (const resultSelector of resultSelectors) {
                try {
                    await page.waitForSelector(resultSelector, { timeout: 3000 });
                    const results = await page.$$(resultSelector);
                    if (results.length > 0) {
                        // Scroll to make the element visible
                        await results[0].scrollIntoViewIfNeeded();
                        await this.delay(500);
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
                await this.delay(500);
                await anyLink.click();
                console.log('Clicked on a generic link that appears to be a search result');
                return true;
            }
        } catch (altError) {
            console.error(`Failed to click alternative results: ${altError.message}`);
        }

        console.error('Failed to click any element');
        return false;
    }

    // Add the type method
    async type(selector, text) {
        const page = await this.getPage();

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
                        return true;
                    }
                } catch (selectorError) {
                    // Continue to the next selector
                    console.log(`Selector ${singleSelector} not found, trying next...`);
                }
            }

            // If we get here, none of the selectors worked
            console.error(`None of the provided selectors worked for typing "${text}"`);

            // Try common input selectors as a fallback
            return this.tryCommonInputSelectors(page, text);
        }

        // Original code for string selector
        try {
            await page.waitForSelector(selector, { timeout: 10000 });
            // Clear the field first
            await page.fill(selector, '');
            // Type with a slight delay between characters to simulate human typing
            await page.fill(selector, text, { delay: 100 });
            console.log(`Typed "${text}" into ${selector}`);
            return true;
        } catch (error) {
            console.error(`Type error on ${selector}: ${error.message}`);

            // Try common input selectors based on context
            return this.tryCommonInputSelectors(page, text);
        }
    }

    // Helper method to try common input selectors
    async tryCommonInputSelectors(page, text) {
        try {
            // Common search input selectors
            const searchInputs = [
                'textarea[name="q"]',
                'input[name="q"]',
                'input[title="Search"]',
                'input.gLFyf',
                'textarea.gLFyf',
                '[aria-label="Search"]',
                '[type="search"]'
            ];

            // Add YouTube-specific selectors
            if (page.url().includes('youtube')) {
                searchInputs.unshift(
                    'input#search',
                    'input[name="search_query"]',
                    'input[id="search"]',
                    'input[aria-label="Search"]',
                    'input.ytd-searchbox'
                );

                // YouTube sometimes needs time to load its search box
                await this.delay(2000);
            }

            for (const inputSelector of searchInputs) {
                try {
                    await page.waitForSelector(inputSelector, { timeout: 3000 });
                    const input = await page.$(inputSelector);
                    if (input) {
                        await input.fill(text, { delay: 100 });
                        console.log(`Typed "${text}" into alternative input: ${inputSelector}`);
                        return true;
                    }
                } catch (selectorError) {
                    // Continue to the next selector
                }
            }

            // If all else fails, try to focus on the page and type
            await page.click('body');
            await page.keyboard.type(text, { delay: 100 });
            console.log(`Typed "${text}" directly using keyboard`);
            return true;
        } catch (altError) {
            console.error(`Failed to type in alternative inputs: ${altError.message}`);
            return false;
        }
    }

    // Add waitForNavigation method
    async waitForNavigation(timeout = 30000) {
        const page = await this.getPage();
        try {
            await page.waitForNavigation({ timeout });
            console.log('Navigation completed');
            return true;
        } catch (error) {
            console.error(`Wait for navigation error: ${error.message}`);
            return false;
        }
    }

    // Add extractText method
    async extractText(selector) {
        const page = await this.getPage();
        try {
            await page.waitForSelector(selector, { timeout: 10000 });
            const text = await page.$eval(selector, el => el.textContent.trim());
            console.log(`Extracted text from ${selector}: ${text}`);
            return text;
        } catch (error) {
            console.error(`Extract text error on ${selector}: ${error.message}`);
            return null;
        }
    }

    // Add extractData method for the extract API
    async extractData(selectors, options = {}) {
        const page = await this.getPage();
        const result = {};

        // Add metadata about the page
        result.metadata = {
            url: page.url(),
            title: await page.title(),
            timestamp: new Date().toISOString()
        };

        // Process each selector
        for (const [key, selectorInfo] of Object.entries(selectors)) {
            try {
                // Handle both simple string selectors and complex selector objects
                let selector, attribute, transform;

                if (typeof selectorInfo === 'string') {
                    selector = selectorInfo;
                    attribute = 'textContent';
                } else {
                    selector = selectorInfo.selector;
                    attribute = selectorInfo.attribute || 'textContent';
                    transform = selectorInfo.transform;
                }

                await page.waitForSelector(selector, { timeout: 5000 });
                const elements = await page.$$(selector);

                if (elements.length === 0) {
                    result[key] = null;
                    continue;
                }

                // Extract the specified attribute from elements
                let extractedData;
                if (elements.length === 1 && !options.forceArray) {
                    // Single element
                    if (attribute === 'textContent') {
                        extractedData = await elements[0].evaluate(el => el.textContent.trim());
                    } else if (attribute === 'html' || attribute === 'innerHTML') {
                        extractedData = await elements[0].evaluate(el => el.innerHTML);
                    } else {
                        extractedData = await elements[0].evaluate((el, attr) => el.getAttribute(attr), attribute);
                    }
                } else {
                    // Multiple elements
                    extractedData = await Promise.all(
                        elements.map(async(el) => {
                            if (attribute === 'textContent') {
                                return el.evaluate(node => node.textContent.trim());
                            } else if (attribute === 'html' || attribute === 'innerHTML') {
                                return el.evaluate(node => node.innerHTML);
                            } else {
                                return el.evaluate((node, attr) => node.getAttribute(attr), attribute);
                            }
                        })
                    );
                }

                // Apply transformation if provided
                if (transform && typeof transform === 'function') {
                    extractedData = transform(extractedData);
                }

                result[key] = extractedData;
                console.log(`Extracted ${key} using selector ${selector}`);
            } catch (error) {
                console.error(`Failed to extract ${key}: ${error.message}`);
                result[key] = null;
            }
        }

        return result;
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.context = null;
                this.page = null;
                console.log('Browser closed successfully');
            }
        } catch (error) {
            console.error(`Error closing browser: ${error.message}`);
        }
    }
}

// Singleton instance
const browserController = new BrowserController();

module.exports = { browserController };


// Handle Amazon C