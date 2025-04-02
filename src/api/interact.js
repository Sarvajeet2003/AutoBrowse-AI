const express = require('express');
const { browserController } = require('../browser/controller');
const { processCommand } = require('../utils/nlProcessor');

const router = express.Router();

// Make sure the route is properly defined
router.post('/', async(req, res) => {
    try {
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({
                success: false,
                error: 'Command is required'
            });
        }

        console.log('Received command:', command);

        // Process the command
        const result = await processCommand(command);

        // Execute the actions
        if (result && result.actions && Array.isArray(result.actions)) {
            for (const action of result.actions) {
                try {
                    switch (action.type) {
                        case 'navigate':
                            await browserController.navigate(action.params.url);
                            break;
                        case 'click':
                            await browserController.click(action.params.selector, action.params.options);
                            break;
                        case 'type':
                            await browserController.type(action.params.selector, action.params.text);
                            break;
                        case 'wait':
                            await browserController.delay(action.params.timeout || 1000);
                            break;
                        default:
                            console.warn(`Unknown action type: ${action.type}`);
                    }
                } catch (actionError) {
                    console.error(`Error executing action ${action.type}:`, actionError);
                    // Continue with next action instead of failing completely
                }
            }

            return res.json({
                success: true,
                message: 'Command executed successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid command structure'
            });
        }
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

module.exports = {
    interactRouter: router
};