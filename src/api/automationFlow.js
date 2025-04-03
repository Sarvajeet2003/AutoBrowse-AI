const express = require('express');
const { browserController } = require('../browser/controller');

const router = express.Router();

router.post('/', async(req, res) => {
    try {
        const { steps } = req.body;

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Steps are required and must be a non-empty array' 
            });
        }

        // Run the automation flow
        const results = await browserController.runAutomationFlow(steps);

        return res.json({
            success: results.success,
            results: results
        });
    } catch (error) {
        console.error('Error running automation flow:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Get the status of the browser
router.get('/status', async(req, res) => {
    try {
        const status = {
            browserInitialized: browserController.browser !== null,
            usingNativeBrowser: browserController.usingNativeBrowser,
            currentUrl: null
        };

        if (browserController.page) {
            try {
                status.currentUrl = await browserController.page.url();
            } catch (e) {
                status.currentUrl = 'Unknown';
            }
        }

        return res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Error getting browser status:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

module.exports = router;