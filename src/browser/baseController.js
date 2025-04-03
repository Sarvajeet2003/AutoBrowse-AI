const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

class BaseBrowserController {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.usingNativeBrowser = false;
        this.proxyConfig = null;
        this.extensionPaths = [];
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getPage() {
        if (!this.page) {
            await this.initialize();
        }
        return this.page;
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

module.exports = BaseBrowserController;