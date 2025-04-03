const { GoogleGenerativeAI } = require('@google/generative-ai');
const { conversationContext } = require('./conversationContext');
require('dotenv').config();

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function processCommandWithContext(command, sessionId) {
    try {
        // Get or create session
        const session = conversationContext.getSession(sessionId);
        
        // Add user message to context
        conversationContext.addMessage(sessionId, 'user', command);
        
        // Check for special commands that reference previous context
        const lowerCommand = command.toLowerCase();
        
        // Handle context-aware commands
        if (lowerCommand.includes('same as before') || 
            lowerCommand.includes('do it again') || 
            lowerCommand.includes('repeat that')) {
            
            // Find the most recent command that was processed successfully
            const previousCommands = session.context
                .filter(msg => msg.role === 'assistant' && msg.actions)
                .reverse();
            
            if (previousCommands.length > 0) {
                const previousResult = previousCommands[0];
                
                // Add assistant message to context
                conversationContext.addMessage(
                    sessionId, 
                    'assistant', 
                    `Repeating previous command: ${previousResult.originalCommand}`
                );
                
                return previousResult.actions;
            }
        }
        
        // Handle commands that reference variables
        if (lowerCommand.includes('go back to') || 
            lowerCommand.includes('return to') ||
            lowerCommand.includes('that site') ||
            lowerCommand.includes('that page')) {
            
            const lastUrl = conversationContext.getVariable(sessionId, 'lastUrl');
            
            if (lastUrl) {
                const result = {
                    actions: [{
                        type: 'navigate',
                        params: { url: lastUrl }
                    }]
                };
                
                // Add assistant message to context
                conversationContext.addMessage(
                    sessionId, 
                    'assistant', 
                    `Navigating back to ${lastUrl}`
                );
                
                return result;
            }
        }
        
        // Special handling for YouTube commands
        if (lowerCommand.includes('youtube') &&
            (lowerCommand.includes('search') || lowerCommand.includes('filter'))) {
            
            const actions = [];

            // Navigate to YouTube
            actions.push({
                type: 'navigate',
                params: { url: 'youtube.com' }
            });

            // Add a longer wait for YouTube to load properly
            actions.push({
                type: 'wait',
                params: { timeout: 5000 }
            });

            // Extract search query if present
            if (command.toLowerCase().includes('search for') || command.toLowerCase().includes('find')) {
                // Improved regex to handle more query formats
                const searchMatch = command.match(/(?:search for|find|look for) ["']?(.*?)["']?(?:,|\s+and|\s+filter|\s+on|\s*$)/i);
                const searchQuery = searchMatch ? searchMatch[1].trim() : '';

                if (searchQuery) {
                    // Use multiple selectors for YouTube search input
                    actions.push({
                        type: 'type',
                        params: {
                            // Provide multiple selectors to try
                            selector: [
                                'input#search',
                                'input[name="search_query"]',
                                'input[id="search"]',
                                'input[aria-label="Search"]',
                                'input.ytd-searchbox',
                                'input[placeholder*="Search"]' // Added more generic selector
                            ],
                            text: searchQuery
                        }
                    });

                    // Try multiple ways to submit the search
                    actions.push({
                        type: 'click',
                        params: {
                            selector: [
                                '#search-icon-legacy',
                                'button[aria-label="Search"]',
                                'button.ytd-searchbox'
                            ],
                            fallback: 'enterKey' // Use Enter key as fallback
                        }
                    });

                    // Wait for results to load
                    actions.push({
                        type: 'wait',
                        params: { timeout: 5000 }
                    });
                }
            }

            // Handle filter request
            if (command.toLowerCase().includes('filter') && command.toLowerCase().includes('this month')) {
                // Click on filter button with multiple selector options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'button[aria-label="Search filters"]',
                            'button.ytd-toggle-button-renderer',
                            'yt-icon-button.ytd-toggle-button-renderer',
                            '#filter-button',
                            'button:has-text("Filter")'
                        ]
                    }
                });

                // Wait for filter menu
                actions.push({
                    type: 'wait',
                    params: { timeout: 2000 }
                });

                // Click on "Upload date" with multiple selector options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'yt-formatted-string:has-text("Upload date")',
                            'span:has-text("Upload date")',
                            'div[title="Upload date"]'
                        ]
                    }
                });

                // Wait for submenu
                actions.push({
                    type: 'wait',
                    params: { timeout: 2000 }
                });

                // Click on "This month" with multiple selector options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'yt-formatted-string:has-text("This month")',
                            'span:has-text("This month")',
                            'div[title="This month"]'
                        ]
                    }
                });
            }

            return { actions };
        }
        
        // For other commands, use Gemini API with conversation history
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Prepare conversation history for the API
        const history = session.context
            .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string'))
            .map(msg => ({
                role: msg.role,
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            }));
        
        // Create a chat session
        const chat = model.startChat({
            history,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1000,
            },
        });
        
        // Add system prompt to guide the model
        const systemPrompt = `
        You are an AI assistant that helps users control a web browser. 
        Convert the user's natural language command into a sequence of browser actions.
        
        Your response should be in JSON format with an 'actions' array containing objects with 'type' and 'params'.
        
        Supported action types:
        - navigate: Go to a URL (params: url)
        - click: Click on an element (params: selector, options)
        - type: Type text into an input field (params: selector, text)
        - wait: Wait for a specified time (params: timeout in ms)
        
        Example response:
        {
          "actions": [
            {
              "type": "navigate",
              "params": { "url": "https://google.com" }
            },
            {
              "type": "type",
              "params": { "selector": "input[name='q']", "text": "weather forecast" }
            },
            {
              "type": "click",
              "params": { "selector": "input[name='btnK']" }
            }
          ]
        }
        
        Current context variables:
        ${JSON.stringify(session.variables, null, 2)}
        `;
        
        // Send the command to the model
        const result = await chat.sendMessage(systemPrompt + "\n\nUser command: " + command);
        const responseText = result.response.text();
        
        // Try to parse the JSON response
        try {
            // Extract JSON from the response (it might be wrapped in markdown code blocks)
            const jsonMatch = responseText.match(/```(?:json)?([\s\S]*?)```/) || 
                              responseText.match(/({[\s\S]*})/);
            
            const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
            const parsedResponse = JSON.parse(jsonStr);
            
            if (parsedResponse && parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
                // Store the result in the conversation context
                conversationContext.addMessage(sessionId, 'assistant', {
                    message: 'Processed command with AI',
                    actions: parsedResponse.actions,
                    originalCommand: command
                });
                
                // Store URL if navigating
                const navigateAction = parsedResponse.actions.find(a => a.type === 'navigate');
                if (navigateAction && navigateAction.params && navigateAction.params.url) {
                    conversationContext.setVariable(sessionId, 'lastUrl', navigateAction.params.url);
                }
                
                return parsedResponse;
            }
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
        }
        
        // Fallback to simple processing if AI parsing fails
        return processCommand(command);
    } catch (error) {
        console.error('Error processing command with context:', error);
        // Fallback to the original processor
        return processCommand(command);
    }
}

// Keep the original processCommand function for backward compatibility
async function processCommand(command) {
    try {
        // Special handling for YouTube commands
        if (command.toLowerCase().includes('youtube') &&
            (command.toLowerCase().includes('search') || command.toLowerCase().includes('filter'))) {

            const actions = [];

            // Navigate to YouTube
            actions.push({
                type: 'navigate',
                params: { url: 'youtube.com' }
            });

            // Add a longer wait for YouTube to load properly
            actions.push({
                type: 'wait',
                params: { timeout: 5000 }
            });

            // Extract search query if present
            if (command.toLowerCase().includes('search for') || command.toLowerCase().includes('find')) {
                // Improved regex to handle more query formats
                const searchMatch = command.match(/(?:search for|find|look for) ["']?(.*?)["']?(?:,|\s+and|\s+filter|\s+on|\s*$)/i);
                const searchQuery = searchMatch ? searchMatch[1].trim() : '';

                if (searchQuery) {
                    // Use multiple selectors for YouTube search input
                    actions.push({
                        type: 'type',
                        params: {
                            // Provide multiple selectors to try
                            selector: [
                                'input#search',
                                'input[name="search_query"]',
                                'input[id="search"]',
                                'input[aria-label="Search"]',
                                'input.ytd-searchbox',
                                'input[placeholder*="Search"]' // Added more generic selector
                            ],
                            text: searchQuery
                        }
                    });

                    // Try multiple ways to submit the search
                    actions.push({
                        type: 'click',
                        params: {
                            selector: [
                                '#search-icon-legacy',
                                'button[aria-label="Search"]',
                                'button.ytd-searchbox'
                            ],
                            fallback: 'enterKey' // Use Enter key as fallback
                        }
                    });

                    // Wait for results to load
                    actions.push({
                        type: 'wait',
                        params: { timeout: 5000 }
                    });
                }
            }

            // Handle filter request
            if (command.toLowerCase().includes('filter') && command.toLowerCase().includes('this month')) {
                // Click on filter button with multiple selector options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'button[aria-label="Search filters"]',
                            'button.ytd-toggle-button-renderer',
                            'yt-icon-button.ytd-toggle-button-renderer',
                            '#filter-button',
                            'button:has-text("Filter")'
                        ]
                    }
                });

                // Wait for filter menu
                actions.push({
                    type: 'wait',
                    params: { timeout: 2000 }
                });

                // Click on "Upload date" with multiple selector options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'yt-formatted-string:has-text("Upload date")',
                            'span:has-text("Upload date")',
                            'div[title="Upload date"]'
                        ]
                    }
                });

                // Wait for submenu
                actions.push({
                    type: 'wait',
                    params: { timeout: 2000 }
                });

                // Click on "This month" with multiple selector options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'yt-formatted-string:has-text("This month")',
                            'span:has-text("This month")',
                            'div[title="This month"]'
                        ]
                    }
                });
            }

            return { actions };
        }

        // Special handling for Google commands
        if (command.toLowerCase().includes('google') &&
            command.toLowerCase().includes('search')) {

            const actions = [];

            // Navigate to Google
            actions.push({
                type: 'navigate',
                params: { url: 'google.com' }
            });

            // Wait for Google to load
            actions.push({
                type: 'wait',
                params: { timeout: 3000 }
            });

            // Extract search query
            const searchMatch = command.match(/search for (.*?)(?:,|\s+and|\s*$)/i);
            const searchQuery = searchMatch ? searchMatch[1] : '';

            if (searchQuery) {
                // Type with multiple selector options for Google search
                actions.push({
                    type: 'type',
                    params: {
                        selector: [
                            'textarea[name="q"]',
                            'input[name="q"]',
                            'input[title="Search"]',
                            'input.gLFyf',
                            'textarea.gLFyf',
                            '[aria-label="Search"]',
                            '[type="search"]'
                        ],
                        text: searchQuery
                    }
                });

                // Submit search with multiple options
                actions.push({
                    type: 'click',
                    params: {
                        selector: [
                            'input[name="btnK"]',
                            'input[value="Google Search"]',
                            'button[aria-label="Google Search"]',
                            'button.gNO89b',
                            'input.gNO89b',
                            'input[type="submit"]',
                            'button[type="submit"]'
                        ],
                        fallback: 'enterKey'
                    }
                });

                // Wait for results
                actions.push({
                    type: 'wait',
                    params: { timeout: 5000 }
                });
            }

            return { actions };
        }

        // Get the generative model for other commands
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Create the prompt with enhanced instructions for robustness
        const prompt = `You are a browser automation assistant. Convert natural language commands into structured browser actions.
        Return JSON with the following structure:
        {
          "actions": [
            {
              "type": "navigate" | "click" | "type" | "wait" | "extract",
              "params": {
                // For selectors, provide an array of alternative selectors to try
                "selector": ["primary-selector", "alternative-selector-1", "alternative-selector-2"],
                // For click actions, you can specify a fallback method
                "fallback": "enterKey", // Optional: use Enter key if click fails
                // Other parameters specific to the action type
              }
            }
          ]
        }

        Important guidelines:
        1. Always include a wait action after navigation (3-5 seconds)
        2. For search inputs, provide multiple selector alternatives
        3. For buttons, provide multiple selector alternatives
        4. For critical actions, include fallback methods
        5. Add appropriate waits between actions that change the page state

        The natural language command is: ${command}`;

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from the response
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
            text.match(/```\n([\s\S]*?)\n```/) ||
            text.match(/{[\s\S]*?}/);

        const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;

        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error processing command:', error);
        throw new Error('Failed to process natural language command: ' + error.message);
    }
}

module.exports = { processCommand, processCommandWithContext };