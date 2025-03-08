class MemoryManager {
    constructor() {
        this.memoryPrefix = 'healthcare_companion_';
        this.memoryTypes = {
            PERSONAL: 'personal',
            MEDICAL: 'medical',
            CONVERSATION: 'conversation',
            PREFERENCE: 'preference'
        };
        this.maxMemories = 100; // Maximum memories to store per user
    }

    // Generate a key for storing in localStorage
    generateKey(userId, type, identifier = '') {
        return `${this.memoryPrefix}${userId}_${type}_${identifier}`;
    }

    // Store a memory
    setMemory(userId, type, data, identifier = '') {
        if (!userId || !type || !data) {
            console.error('Missing required parameters for memory storage');
            return false;
        }

        // Create memory object with metadata
        const memory = {
            data: data,
            timestamp: new Date().toISOString(),
            type: type
        };

        // For identifiable memories (like specific medical readings)
        if (identifier) {
            const key = this.generateKey(userId, type, identifier);
            this.setItem(key, JSON.stringify(memory));
            return true;
        }

        // For sequential memories (like conversations)
        const memoriesKey = this.generateKey(userId, type, 'collection');
        let memories = this.getItem(memoriesKey);
        
        if (memories) {
            memories = JSON.parse(memories);
        } else {
            memories = [];
        }

        // Add new memory and trim if exceeding max
        memories.push(memory);
        if (memories.length > this.maxMemories) {
            memories = memories.slice(-this.maxMemories);
        }

        this.setItem(memoriesKey, JSON.stringify(memories));
        return true;
    }

    // Retrieve memories of a specific type
    getMemories(userId, type, identifier = '') {
        if (!userId || !type) {
            console.error('Missing required parameters for memory retrieval');
            return null;
        }

        if (identifier) {
            const key = this.generateKey(userId, type, identifier);
            const memory = this.getItem(key);
            return memory ? JSON.parse(memory) : null;
        }

        const memoriesKey = this.generateKey(userId, type, 'collection');
        const memories = this.getItem(memoriesKey);
        return memories ? JSON.parse(memories) : [];
    }

    // Search memories for specific content
    searchMemories(userId, searchTerm) {
        if (!userId || !searchTerm) {
            console.error('Missing required parameters for memory search');
            return [];
        }

        const results = [];
        const types = Object.values(this.memoryTypes);

        for (const type of types) {
            const memories = this.getMemories(userId, type);
            
            if (Array.isArray(memories)) {
                const matchingMemories = memories.filter(memory => 
                    JSON.stringify(memory.data).toLowerCase().includes(searchTerm.toLowerCase())
                );
                
                results.push(...matchingMemories);
            }
        }

        return results;
    }

    // Get all memory types for a user
    getAllUserMemories(userId) {
        if (!userId) {
            console.error('User ID is required for getting all memories');
            return {};
        }

        const result = {};
        const types = Object.values(this.memoryTypes);

        for (const type of types) {
            result[type] = this.getMemories(userId, type);
        }

        return result;
    }

    // Store a non-memory item
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error('Error storing data in localStorage:', e);
            return false;
        }
    }

    // Get a non-memory item
    getItem(key) {
        return localStorage.getItem(key);
    }

    // Remove a memory or item
    removeItem(key) {
        localStorage.removeItem(key);
    }

    // Clear all memories for a user
    clearUserMemories(userId) {
        if (!userId) {
            console.error('User ID is required for clearing memories');
            return false;
        }

        // Get all keys in localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(`${this.memoryPrefix}${userId}_`)) {
                localStorage.removeItem(key);
            }
        }

        return true;
    }

    // Add conversation memory
    addConversation(userId, userMessage, botResponse) {
        return this.setMemory(userId, this.memoryTypes.CONVERSATION, {
            user: userMessage,
            bot: botResponse
        });
    }

    // Get recent conversations
    getRecentConversations(userId, limit = 10) {
        const conversations = this.getMemories(userId, this.memoryTypes.CONVERSATION);
        return conversations.slice(-limit);
    }
}

export default MemoryManager;

