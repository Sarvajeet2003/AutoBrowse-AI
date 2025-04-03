const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { browserController } = require('../browser/controller');
const { processCommandWithContext } = require('../utils/nlProcessor');
const { conversationContext } = require('../utils/conversationContext');

const router = express.Router();

// Create or continue a conversation session
router.post('/', async(req, res) => {
    try {
        const { command, sessionId } = req.body;
        
        if (!command || typeof command !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Command is required and must be a string'
            });
        }
        
        // Use provided sessionId or generate a new one
        const currentSessionId = sessionId || uuidv4();
        
        console.log(`Processing command in session ${currentSessionId}: ${command}`);
        
        // Process the command with context
        const result = await processCommandWithContext(command, currentSessionId);
        
        if (!result || !result.actions || !Array.isArray(result.actions)) {
            return res.status(400).json({
                success: false,
                error: 'Failed to process command into actionable steps',
                sessionId: currentSessionId
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
                    case 'extract':
                        const extractedData = await browserController.extract(action.params.selectors);
                        if (extractedData) {
                            // Store extracted data in the conversation context
                            conversationContext.setVariable(currentSessionId, 'lastExtractedData', extractedData);
                            success = true;
                        }
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
            details: actionResults,
            sessionId: currentSessionId,
            context: conversationContext.getSession(currentSessionId).variables
        });
    } catch (error) {
        console.error('Error executing command:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Get conversation history
router.get('/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        
        const session = conversationContext.getSession(sessionId);
        
        return res.json({
            success: true,
            sessionId,
            history: session.context,
            variables: session.variables
        });
    } catch (error) {
        console.error('Error getting conversation history:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

// Clear conversation history
router.delete('/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        
        conversationContext.clearSession(sessionId);
        
        return res.json({
            success: true,
            message: 'Conversation history cleared successfully',
            sessionId
        });
    } catch (error) {
        console.error('Error clearing conversation history:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An unknown error occurred'
        });
    }
});

module.exports = router;