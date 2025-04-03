const path = require('path');

class ExtractionHandler {
    constructor(controller) {
        this.controller = controller;
    }

    async extractText(selector) {
        const page = await this.controller.getPage();
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

    async extractData(selectors, options = {}) {
        const page = await this.controller.getPage();
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

                // Wait for the selector to be available
                await page.waitForSelector(selector, { timeout: 5000 });

                // Extract all matching elements if multiple is true
                if (selectorInfo.multiple) {
                    const elements = await page.$$(selector);
                    result[key] = [];

                    for (const element of elements) {
                        let value;
                        
                        if (attribute === 'textContent') {
                            value = await element.evaluate(el => el.textContent.trim());
                        } else if (attribute === 'html' || attribute === 'innerHTML') {
                            value = await element.evaluate(el => el.innerHTML);
                        } else if (attribute === 'outerHTML') {
                            value = await element.evaluate(el => el.outerHTML);
                        } else {
                            value = await element.evaluate((el, attr) => el.getAttribute(attr), attribute);
                        }

                        // Apply transformation if provided
                        if (transform && typeof transform === 'function') {
                            value = transform(value);
                        }

                        result[key].push(value);
                    }
                } else {
                    // Extract single element
                    let value;
                    
                    if (attribute === 'textContent') {
                        value = await page.$eval(selector, el => el.textContent.trim());
                    } else if (attribute === 'html' || attribute === 'innerHTML') {
                        value = await page.$eval(selector, el => el.innerHTML);
                    } else if (attribute === 'outerHTML') {
                        value = await page.$eval(selector, el => el.outerHTML);
                    } else {
                        value = await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
                    }

                    // Apply transformation if provided
                    if (transform && typeof transform === 'function') {
                        value = transform(value);
                    }

                    result[key] = value;
                }
            } catch (error) {
                console.error(`Error extracting ${key} with selector ${typeof selectorInfo === 'string' ? selectorInfo : selectorInfo.selector}: ${error.message}`);
                result[key] = null;
            }
        }

        console.log(`Extracted data: ${JSON.stringify(result, null, 2)}`);
        return result;
    }

    async captureScreenshot(selector, options = {}) {
        const page = await this.controller.getPage();
        try {
            // Generate filename if not provided
            const filename = options.filename || `screenshot-${Date.now()}.png`;
            const fullPath = path.resolve(options.path || '.', filename);
            
            if (selector) {
                // Capture screenshot of specific element
                await page.waitForSelector(selector, { timeout: 5000 });
                const element = await page.$(selector);
                if (element) {
                    await element.screenshot({ path: fullPath });
                    console.log(`Captured screenshot of element ${selector} to ${fullPath}`);
                    return fullPath;
                } else {
                    throw new Error(`Element not found: ${selector}`);
                }
            } else {
                // Capture full page screenshot
                await page.screenshot({ path: fullPath, fullPage: options.fullPage || false });
                console.log(`Captured full page screenshot to ${fullPath}`);
                return fullPath;
            }
        } catch (error) {
            console.error(`Screenshot error: ${error.message}`);
            return null;
        }
    }
}

module.exports = ExtractionHandler;