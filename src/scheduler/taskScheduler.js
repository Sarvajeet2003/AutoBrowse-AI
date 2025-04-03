const cron = require('node-cron');
const { browserController } = require('../browser/controller');
const { processCommand } = require('../utils/nlProcessor');
const fs = require('fs');
const path = require('path');

class TaskScheduler {
    constructor() {
        this.tasks = new Map();
        this.tasksFilePath = path.join(__dirname, '../../data/scheduled-tasks.json');
        this.loadTasks();
    }

    // Load tasks from file
    loadTasks() {
        try {
            // Create directory if it doesn't exist
            const dir = path.dirname(this.tasksFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create file if it doesn't exist
            if (!fs.existsSync(this.tasksFilePath)) {
                fs.writeFileSync(this.tasksFilePath, JSON.stringify([]));
                return;
            }

            const tasksData = JSON.parse(fs.readFileSync(this.tasksFilePath, 'utf8'));
            
            // Schedule each task
            tasksData.forEach(task => {
                this.scheduleTask(task, false); // Don't save to file when loading
            });
            
            console.log(`Loaded ${tasksData.length} scheduled tasks`);
        } catch (error) {
            console.error('Error loading scheduled tasks:', error);
        }
    }

    // Save tasks to file
    saveTasks() {
        try {
            const tasksData = Array.from(this.tasks.values()).map(task => {
                // Create a clean copy without the scheduledTask object
                const { scheduledTask, ...cleanTask } = task;
                return cleanTask;
            });
            
            fs.writeFileSync(this.tasksFilePath, JSON.stringify(tasksData, null, 2));
        } catch (error) {
            console.error('Error saving scheduled tasks:', error);
        }
    }

    // Schedule a new task
    scheduleTask(taskConfig, saveToFile = true) {
        try {
            const { id, name, schedule, workflow, browserConfig } = taskConfig;
            
            if (!id || !schedule || !workflow) {
                throw new Error('Task must have id, schedule, and workflow');
            }
            
            // Validate cron expression
            if (!cron.validate(schedule)) {
                throw new Error(`Invalid cron schedule: ${schedule}`);
            }
            
            // Cancel existing task if it exists
            if (this.tasks.has(id)) {
                this.cancelTask(id, false);
            }
            
            // Schedule the task
            const scheduledTask = cron.schedule(schedule, async () => {
                console.log(`Executing scheduled task: ${name || id}`);
                
                try {
                    // Initialize browser with the specified configuration
                    await browserController.initialize(browserConfig || {
                        useNativeBrowser: true,
                        browserType: 'chrome'
                    });
                    
                    // Execute each step in the workflow
                    if (Array.isArray(workflow)) {
                        // Handle workflow array (automation flow)
                        await browserController.runAutomationFlow(workflow);
                    } else if (typeof workflow === 'string') {
                        // Handle natural language command
                        const result = await processCommand(workflow);
                        
                        if (result && result.actions) {
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
                                    }
                                } catch (actionError) {
                                    console.error(`Error executing action ${action.type}:`, actionError);
                                }
                            }
                        }
                    }
                    
                    // Close the browser after task completion
                    await browserController.close();
                    
                    console.log(`Task ${name || id} completed successfully`);
                } catch (error) {
                    console.error(`Error executing task ${name || id}:`, error);
                    // Ensure browser is closed even if there's an error
                    try {
                        await browserController.close();
                    } catch (closeError) {
                        console.error('Error closing browser:', closeError);
                    }
                }
            });
            
            // Store the task
            this.tasks.set(id, {
                ...taskConfig,
                scheduledTask
            });
            
            console.log(`Task "${name || id}" scheduled with cron: ${schedule}`);
            
            // Save to file if needed
            if (saveToFile) {
                this.saveTasks();
            }
            
            return true;
        } catch (error) {
            console.error('Error scheduling task:', error);
            return false;
        }
    }

    // Cancel a scheduled task
    cancelTask(id, saveToFile = true) {
        try {
            const task = this.tasks.get(id);
            
            if (!task) {
                console.warn(`Task with ID ${id} not found`);
                return false;
            }
            
            // Stop the scheduled task
            if (task.scheduledTask) {
                task.scheduledTask.stop();
            }
            
            // Remove from map
            this.tasks.delete(id);
            console.log(`Task "${task.name || id}" cancelled`);
            
            // Save to file if needed
            if (saveToFile) {
                this.saveTasks();
            }
            
            return true;
        } catch (error) {
            console.error('Error cancelling task:', error);
            return false;
        }
    }

    // Get all scheduled tasks
    getAllTasks() {
        return Array.from(this.tasks.values()).map(task => {
            // Create a clean copy without the scheduledTask object
            const { scheduledTask, ...cleanTask } = task;
            return cleanTask;
        });
    }

    // Get a specific task by ID
    getTask(id) {
        const task = this.tasks.get(id);
        if (!task) return null;
        
        // Create a clean copy without the scheduledTask object
        const { scheduledTask, ...cleanTask } = task;
        return cleanTask;
    }
}

// Create and export a singleton instance
const taskScheduler = new TaskScheduler();
module.exports = { taskScheduler };