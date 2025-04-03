const express = require('express');
const { browserController } = require('../browser/controller');
const { processCommand } = require('../utils/nlProcessor');

const router = express.Router();

// Make sure the route is properly defined
router.post('/', async(req, res) => {
    try {
        const { command } = req.body;

        if (!command || typeof command !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Command is required and must be a string'
            });
        }

        console.log('Received command:', command);

        // Process the command
        let result;
        try {
            result = await processCommand(command);
        } catch (processError) {
            console.error('Error processing command:', processError);
            return res.status(500).json({
                success: false,
                error: 'Failed to process command: ' + processError.message
            });
        }

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
                // Continue with next action instead of failing completely
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

// Add a GET method for testing
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Interact API is running',
        usage: 'Send a POST request with a "command" property in the request body'
    });
});

module.exports = router;