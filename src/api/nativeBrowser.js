const express = require('express');
const { browserController } = require('../browser/controller');
const { processCommand } = require('../utils/nlProcessor');

const router = express.Router();

router.post('/launch', async(req, res) => {
    try {
        const { useNativeBrowser, proxy, extensions } = req.body;

        // Initialize browser with options
        await browserController.initialize({
            useNativeBrowser: useNativeBrowser === true,
            proxy: proxy,
            extensions: extensions
        });

        return res.json({
            success: true,
            message: `Browser ${useNativeBrowser ? 'native' : 'Playwright'} launched successfully`,
            usingNativeBrowser: browserController.usingNativeBrowser
        });
    } catch (error) {
        console.error('Error launching browser:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

router.post('/login', async(req, res) => {
    try {
        const { url, username, password } = req.body;

        if (!url || !username || !password) {
            return res.status(400).json({
                success: false,
                error: 'URL, username and password are required'
            });
        }

        const success = await browserController.login(url, { username, password });

        return res.json({
            success: success,
            message: success ? 'Login successful' : 'Login failed'
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

router.post('/command', async(req, res) => {
    try {
        const { command } = req.body;

        if (!command || typeof command !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Command is required and must be a string'
            });
        }

        console.log('Received command for native browser:', command);

        // Process the command
        const result = await processCommand(command);

        if (!result || !result.actions || !Array.isArray(result.actions)) {
            return res.status(400).json({
                success: false,
                error: 'Failed to process command into actionable steps'
            });
        }

        // Track successful and failed actions
        const actionResults = {
            successful: [],
            failed: []
        };

        // Execute the actions
        for (const action of result.actions) {
            try {
                let success = false;

                switch (action.type) {
                    case 'navigate':
                        success = await browserController.navigate(action.params.url);
                        break;
                    case 'click':
                        success = await browserController.click(action.params.selector, action.params.options);
                        break;
                    case 'type':
                        success = await browserController.type(action.params.selector, action.params.text);
                        break;
                    case 'wait':
                        await browserController.delay(action.params.timeout || 1000);
                        success = true;
                        break;
                    default:
                        console.warn(`Unknown action type: ${action.type}`);
                        success = false;
                }

                if (success) {
                    actionResults.successful.push(action.type);
                } else {
                    actionResults.failed.push(action.type);
                }
            } catch (actionError) {
                console.error(`Error executing action ${action.type}:`, actionError);
                actionResults.failed.push(action.type);
            }
        }

        return res.json({
            success: actionResults.failed.length === 0,
            message: actionResults.failed.length === 0 ?
                'Command executed successfully' : 'Command executed with some errors',
            details: actionResults
        });
    } catch (error) {
        console.error('Error executing command:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

router.post('/close', async(req, res) => {
    try {
        await browserController.close();
        return res.json({
            success: true,
            message: 'Browser closed successfully'
        });
    } catch (error) {
        console.error('Error closing browser:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Define your routes here
router.get('/', (req, res) => {
    res.json({ message: 'Native browser API is working' });
});

// Export the router
module.exports = router;