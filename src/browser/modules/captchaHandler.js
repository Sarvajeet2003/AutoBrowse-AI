class CaptchaHandler {
    constructor(controller) {
        this.controller = controller;
    }

    async handleAmazonCaptcha() {
        const page = await this.controller.getPage();
        try {
            // Check if we're on an Amazon CAPTCHA page - improved detection
            const captchaElements = [
                'input[name="field-keywords"]',
                'img[src*="captcha"]',
                'input.a-input-text',
                'form[action*="captcha"]',
                'div.a-box-inner:has-text("Type the characters")',
                'div.a-box-inner:has-text("Enter the characters")'
            ];

            let isCaptchaPage = false;
            for (const selector of captchaElements) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        isCaptchaPage = true;
                        console.log(`Amazon CAPTCHA detected via selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    // Continue checking other selectors
                }
            }

            if (isCaptchaPage) {
                console.log('Amazon CAPTCHA page detected, waiting for manual resolution...');
                
                // Notify the user about the CAPTCHA
                await page.evaluate(() => {
                    const div = document.createElement('div');
                    div.style.position = 'fixed';
                    div.style.top = '0';
                    div.style.left = '0';
                    div.style.width = '100%';
                    div.style.padding = '10px';
                    div.style.backgroundColor = 'red';
                    div.style.color = 'white';
                    div.style.textAlign = 'center';
                    div.style.zIndex = '9999';
                    div.textContent = 'CAPTCHA detected! Please solve it manually and then click anywhere on the page to continue.';
                    document.body.appendChild(div);
                });

                // Wait for user to solve CAPTCHA and click anywhere
                await page.waitForEvent('click', { timeout: 300000 }); // 5 minutes timeout
                
                // Remove the notification
                await page.evaluate(() => {
                    const notification = document.querySelector('div[style*="position: fixed"][style*="red"]');
                    if (notification) notification.remove();
                });

                console.log('User interaction detected, continuing...');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Error handling Amazon CAPTCHA: ${error.message}`);
            return false;
        }
    }

    async handleGoogleRecaptcha() {
        const page = await this.controller.getPage();
        try {
            // Check for Google reCAPTCHA presence
            const recaptchaFrameSelectors = [
                'iframe[src*="recaptcha"]',
                'iframe[title*="recaptcha"]',
                'iframe[title*="reCAPTCHA"]',
                'div.g-recaptcha',
                'div[data-sitekey]'
            ];

            let isRecaptchaPresent = false;
            for (const selector of recaptchaFrameSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        isRecaptchaPresent = true;
                        console.log(`Google reCAPTCHA detected via selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    // Continue checking other selectors
                }
            }

            if (isRecaptchaPresent) {
                console.log('Google reCAPTCHA detected, waiting for manual resolution...');
                
                // Notify the user about the reCAPTCHA
                await page.evaluate(() => {
                    const div = document.createElement('div');
                    div.style.position = 'fixed';
                    div.style.top = '0';
                    div.style.left = '0';
                    div.style.width = '100%';
                    div.style.padding = '10px';
                    div.style.backgroundColor = 'blue';
                    div.style.color = 'white';
                    div.style.textAlign = 'center';
                    div.style.zIndex = '9999';
                    div.textContent = 'reCAPTCHA detected! Please solve it manually and then click the submit button.';
                    document.body.appendChild(div);
                });

                // Try to click the reCAPTCHA checkbox if it exists
                try {
                    const frames = page.frames();
                    for (const frame of frames) {
                        const url = frame.url();
                        if (url.includes('recaptcha')) {
                            console.log('Found reCAPTCHA iframe, attempting to interact with it');
                            
                            // Try to find and click the checkbox
                            const checkbox = await frame.$('div.recaptcha-checkbox-border');
                            if (checkbox) {
                                await checkbox.click();
                                console.log('Clicked reCAPTCHA checkbox');
                            }
                        }
                    }
                } catch (frameError) {
                    console.error(`Error interacting with reCAPTCHA frame: ${frameError.message}`);
                }

                // Wait for user to solve reCAPTCHA and submit the form
                // We'll wait for navigation or a click event
                try {
                    await Promise.race([
                        page.waitForNavigation({ timeout: 300000 }), // 5 minutes timeout
                        page.waitForEvent('click', { timeout: 300000 })
                    ]);
                } catch (timeoutError) {
                    console.error('Timeout waiting for reCAPTCHA resolution');
                }
                
                // Remove the notification
                await page.evaluate(() => {
                    const notification = document.querySelector('div[style*="position: fixed"][style*="blue"]');
                    if (notification) notification.remove();
                });

                console.log('User interaction detected, continuing...');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Error handling Google reCAPTCHA: ${error.message}`);
            return false;
        }
    }

    async handleCloudflareChallenge() {
        const page = await this.controller.getPage();
        try {
            // Check for Cloudflare challenge page
            const cloudflareSelectors = [
                'div.cf-browser-verification',
                'div.cf-im-under-attack',
                'div.cf-error-code',
                'span:has-text("Checking your browser")',
                'div:has-text("Please wait while we verify")'
            ];

            let isCloudflareChallenge = false;
            for (const selector of cloudflareSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        isCloudflareChallenge = true;
                        console.log(`Cloudflare challenge detected via selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    // Continue checking other selectors
                }
            }

            if (isCloudflareChallenge) {
                console.log('Cloudflare challenge detected, waiting for resolution...');
                
                // Notify the user
                await page.evaluate(() => {
                    const div = document.createElement('div');
                    div.style.position = 'fixed';
                    div.style.top = '0';
                    div.style.left = '0';
                    div.style.width = '100%';
                    div.style.padding = '10px';
                    div.style.backgroundColor = 'orange';
                    div.style.color = 'black';
                    div.style.textAlign = 'center';
                    div.style.zIndex = '9999';
                    div.textContent = 'Cloudflare challenge detected! Please wait while it resolves automatically...';
                    document.body.appendChild(div);
                });

                // Wait for Cloudflare to resolve (usually automatic)
                // We'll wait for navigation or for the challenge elements to disappear
                try {
                    await Promise.race([
                        page.waitForNavigation({ timeout: 30000 }), // 30 seconds timeout
                        page.waitForFunction(() => {
                            const elements = document.querySelectorAll('.cf-browser-verification, .cf-im-under-attack, .cf-error-code');
                            return elements.length === 0;
                        }, { timeout: 30000 })
                    ]);
                } catch (timeoutError) {
                    console.error('Timeout waiting for Cloudflare challenge resolution');
                }
                
                // Remove the notification
                await page.evaluate(() => {
                    const notification = document.querySelector('div[style*="position: fixed"][style*="orange"]');
                    if (notification) notification.remove();
                });

                console.log('Cloudflare challenge appears to be resolved, continuing...');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Error handling Cloudflare challenge: ${error.message}`);
            return false;
        }
    }

    // General method to check for and handle any type of CAPTCHA
    async checkForCaptcha() {
        try {
            // Check for different types of CAPTCHAs
            const amazonCaptcha = await this.handleAmazonCaptcha();
            if (amazonCaptcha) return true;
            
            const googleRecaptcha = await this.handleGoogleRecaptcha();
            if (googleRecaptcha) return true;
            
            const cloudflareChallenge = await this.handleCloudflareChallenge();
            if (cloudflareChallenge) return true;
            
            return false;
        } catch (error) {
            console.error(`Error checking for CAPTCHAs: ${error.message}`);
            return false;
        }
    }
}

module.exports = CaptchaHandler;