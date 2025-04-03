const fs = require('fs');
const path = require('path');

class ConversationContext {
    constructor() {
        this.sessions = new Map();
        this.sessionsFilePath = path.join(__dirname, '../../data/conversation-sessions.json');
        this.loadSessions();
        
        // Set up session cleanup interval (every hour)
        setInterval(() => this.cleanupSessions(), 60 * 60 * 1000);
    }
    
    // Load sessions from file
    loadSessions() {
        try {
            // Create directory if it doesn't exist
            const dir = path.dirname(this.sessionsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create file if it doesn't exist
            if (!fs.existsSync(this.sessionsFilePath)) {
                fs.writeFileSync(this.sessionsFilePath, JSON.stringify({}));
                return;
            }
            
            const sessionsData = JSON.parse(fs.readFileSync(this.sessionsFilePath, 'utf8'));
            
            // Convert to Map
            Object.entries(sessionsData).forEach(([sessionId, session]) => {
                this.sessions.set(sessionId, session);
            });
            
            console.log(`Loaded ${this.sessions.size} conversation sessions`);
        } catch (error) {
            console.error('Error loading conversation sessions:', error);
        }
    }
    
    // Save sessions to file
    saveSessions() {
        try {
            const sessionsData = Object.fromEntries(this.sessions);
            fs.writeFileSync(this.sessionsFilePath, JSON.stringify(sessionsData, null, 2));
        } catch (error) {
            console.error('Error saving conversation sessions:', error);
        }
    }
    
    // Create a new session or get existing one
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                id: sessionId,
                context: [],
                variables: {},
                lastActivity: Date.now(),
                createdAt: Date.now()
            });
            this.saveSessions();
        } else {
            // Update last activity
            const session = this.sessions.get(sessionId);
            session.lastActivity = Date.now();
            this.sessions.set(sessionId, session);
        }
        
        return this.sessions.get(sessionId);
    }
    
    // Add a message to the conversation context
    addMessage(sessionId, role, content) {
        const session = this.getSession(sessionId);
        
        session.context.push({
            role,
            content,
            timestamp: Date.now()
        });
        
        // Limit context size to last 20 messages
        if (session.context.length > 20) {
            session.context = session.context.slice(-20);
        }
        
        this.sessions.set(sessionId, session);
        this.saveSessions();
        
        return session;
    }
    
    // Set a variable in the session context
    setVariable(sessionId, key, value) {
        const session = this.getSession(sessionId);
        
        session.variables[key] = value;
        session.lastActivity = Date.now();
        
        this.sessions.set(sessionId, session);
        this.saveSessions();
        
        return session;
    }
    
    // Get a variable from the session context
    getVariable(sessionId, key) {
        const session = this.getSession(sessionId);
        return session.variables[key];
    }
    
    // Get the full conversation history
    getConversationHistory(sessionId) {
        const session = this.getSession(sessionId);
        return session.context;
    }
    
    // Clear a session
    clearSession(sessionId) {
        const session = this.getSession(sessionId);
        
        session.context = [];
        session.lastActivity = Date.now();
        
        this.sessions.set(sessionId, session);
        this.saveSessions();
        
        return session;
    }
    
    // Delete a session
    deleteSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            this.sessions.delete(sessionId);
            this.saveSessions();
            return true;
        }
        return false;
    }
    
    // Clean up old sessions (older than 24 hours)
    cleanupSessions() {
        const now = Date.now();
        const expireTime = 24 * 60 * 60 * 1000; // 24 hours
        
        let cleanedCount = 0;
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > expireTime) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} inactive conversation sessions`);
            this.saveSessions();
        }
    }
}

// Create and export a singleton instance
const conversationContext = new ConversationContext();
module.exports = { conversationContext };