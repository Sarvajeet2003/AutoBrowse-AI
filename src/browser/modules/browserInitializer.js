const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

class BrowserInitializer {
    constructor(controller) {
        this.controller = controller;
    }

    async initialize(options = {}) {
        if (!this.controller.browser) {
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
                    this.controller.proxyConfig = options.proxy;
                    launchOptions.proxy = {
                        server: this.controller.proxyConfig.server,
                        username: this.controller.proxyConfig.username,
                        password: this.controller.proxyConfig.password
                    };
                    console.log(`Using proxy: ${this.controller.proxyConfig.server}`);
                }

                // Add extensions if provided
                if (options.extensions && Array.isArray(options.extensions) && options.extensions.length > 0) {
                    this.controller.extensionPaths = options.extensions;
                    // Add extension paths to args
                    for (const extPath of this.controller.extensionPaths) {
                        if (fs.existsSync(extPath)) {
                            launchOptions.args.push(`--disable-extensions-except=${extPath}`);
                            launchOptions.args.push(`--load-extension=${extPath}`);
                            console.log(`Loading extension from: ${extPath}`);
                        } else {
                            console.warn(`Extension path not found: ${extPath}`);
                        }
                    }
                }

                this.controller.browser = await chromium.launch(launchOptions);

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

                this.controller.context = await this.controller.browser.newContext(contextOptions);
                this.controller.page = await this.controller.context.newPage();

                // Modify navigator properties to avoid detection
                await this.controller.page.addInitScript(() => {
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
                    this.controller.browser = await chromium.launch({ headless: false });
                    this.controller.context = await this.controller.browser.newContext();
                    this.controller.page = await this.controller.context.newPage();
                    console.log('Browser initialized with fallback settings');
                } catch (fallbackError) {
                    console.error(`Critical error: Could not initialize browser: ${fallbackError.message}`);
                    throw new Error('Browser initialization failed');
                }
            }
        }
        return this.controller.page;
    }

    async initializeNativeBrowser(options = {}) {
        try {
            this.controller.usingNativeBrowser = true;

            // Determine Chrome executable path based on OS
            const chromePath = await this.detectBrowserPath(options.browserType || 'chrome');
            
            if (!chromePath) {
                throw new Error(`Browser executable not found`);
            }

            // Create a temporary user data directory
            const userDataDir = path.join(os.tmpdir(), `chrome-automation-${Date.now()}`);
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
                console.log(`Created user data directory: ${userDataDir}`);
            }

            // Build Chrome command line arguments
            let args = [
                `--user-data-dir=${userDataDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--remote-debugging-port=9222', // Enable remote debugging
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-features=Translate,BackForwardCache',
                '--disable-hang-monitor',
                '--disable-ipc-flooding-protection',
                '--disable-popup-blocking',
                '--disable-prompt-on-repost',
                '--disable-renderer-backgrounding',
                '--disable-sync',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--no-sandbox',
                '--password-store=basic',
                '--use-mock-keychain'
            ];

            console.log(`Launching browser with command: "${chromePath}" ${args.join(' ')}`);

            // Add proxy if configured
            if (options.proxy) {
                this.controller.proxyConfig = options.proxy;
                args.push(`--proxy-server=${this.controller.proxyConfig.server}`);
                console.log(`Using proxy: ${this.controller.proxyConfig.server}`);
            }

            // Add extensions if provided
            if (options.extensions && Array.isArray(options.extensions) && options.extensions.length > 0) {
                this.controller.extensionPaths = options.extensions;
                const extensionArgs = this.controller.extensionPaths.filter(fs.existsSync).join(',');
                if (extensionArgs) {
                    args.push(`--load-extension=${extensionArgs}`);
                    console.log(`Loading extensions: ${extensionArgs}`);
                }
            }

            // Launch Chrome with the specified arguments
            const browserProcess = exec(`"${chromePath}" ${args.join(' ')}`);
            console.log(`Launched native browser with PID: ${browserProcess.pid}`);

            // Add error handling for the Chrome process
            browserProcess.on('error', (error) => {
                console.error(`Browser process error: ${error.message}`);
            });

            browserProcess.stderr.on('data', (data) => {
                console.error(`Browser stderr: ${data}`);
            });

            // Wait for Chrome to start and connect to it via CDP
            console.log('Waiting for browser to start...');
            await this.controller.delay(5000); // Increase delay to ensure Chrome is fully started

            // Connect to the browser using Playwright's CDP connection
            console.log('Attempting to connect to browser via CDP at http://localhost:9222');
            try {
                this.controller.browser = await chromium.connectOverCDP('http://localhost:9222');
                console.log('Successfully connected to browser via CDP');
            } catch (cdpError) {
                console.error(`Failed to connect via CDP: ${cdpError.message}`);
                
                // Try alternative connection methods
                try {
                    console.log('Trying alternative connection method...');
                    const browserURL = 'http://localhost:9222';
                    const response = await fetch(`${browserURL}/json/version`);
                    const data = await response.json();
                    const webSocketDebuggerUrl = data.webSocketDebuggerUrl;
                    
                    console.log(`Connecting to WebSocket URL: ${webSocketDebuggerUrl}`);
                    this.controller.browser = await chromium.connectOverCDP(webSocketDebuggerUrl);
                    console.log('Successfully connected using WebSocket URL');
                } catch (altError) {
                    console.error(`Alternative connection failed: ${altError.message}`);
                    throw cdpError;
                }
            }
            const contexts = this.controller.browser.contexts();
            this.controller.context = contexts.length > 0 ? contexts[0] : await this.controller.browser.newContext();

            const pages = await this.controller.context.pages();
            this.controller.page = pages.length > 0 ? pages[0] : await this.controller.context.newPage();

            console.log('Connected to native browser');
            return this.controller.page;
        } catch (error) {
            console.error(`Failed to initialize native browser: ${error.message}`);
            this.controller.usingNativeBrowser = false;

            // Fall back to regular Playwright browser
            console.log('Falling back to Playwright-managed browser');
            return this.initialize({...options, useNativeBrowser: false });
        }
    }

    async detectBrowserPath(browserType = 'chrome') {
        const platform = process.platform;
        let possiblePaths = [];
        
        if (browserType.toLowerCase() === 'chrome') {
            if (platform === 'darwin') { // macOS
                possiblePaths = [
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome Canary',
                    `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
                ];
            } else if (platform === 'win32') { // Windows
                possiblePaths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
                ];
            } else if (platform === 'linux') { // Linux
                possiblePaths = [
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable',
                    '/usr/bin/chromium-browser',
                    '/usr/bin/chromium'
                ];
            }
        } else if (browserType.toLowerCase() === 'firefox') {
            if (platform === 'darwin') { // macOS
                possiblePaths = [
                    '/Applications/Firefox.app/Contents/MacOS/firefox',
                    '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
                    `${os.homedir()}/Applications/Firefox.app/Contents/MacOS/firefox`
                ];
            } else if (platform === 'win32') { // Windows
                possiblePaths = [
                    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
                    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
                ];
            } else if (platform === 'linux') { // Linux
                possiblePaths = [
                    '/usr/bin/firefox',
                    '/usr/lib/firefox/firefox'
                ];
            }
        }
        
        // Try to find the executable
        for (const path of possiblePaths) {
            console.log(`Checking ${browserType} path: ${path}`);
            if (fs.existsSync(path)) {
                console.log(`Found ${browserType} at: ${path}`);
                return path;
            }
        }
        
        // If not found in standard locations, try using 'which' command on Unix systems
        if (platform !== 'win32') {
            try {
                const command = browserType.toLowerCase() === 'chrome' 
                    ? 'which google-chrome || which chromium-browser || which chromium' 
                    : 'which firefox';
                
                const { stdout } = await new Promise((resolve, reject) => {
                    exec(command, (error, stdout, stderr) => {
                        if (error && !stdout) {
                            reject(error);
                        } else {
                            resolve({ stdout, stderr });
                        }
                    });
                });
                
                const path = stdout.trim();
                if (path && fs.existsSync(path)) {
                    console.log(`Found ${browserType} using 'which' command at: ${path}`);
                    return path;
                }
            } catch (error) {
                console.log(`Could not find ${browserType} using which command`);
            }
        }
        
        return null;
    }
}

module.exports = BrowserInitializer;