class LLMService {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.systemContext = `You are a healthcare and assistance AI companion designed to provide medical care, emotional support, and assistance. 
You are implemented as a soft-bodied, inflatable robot with advanced sensors and AI diagnostics. 
Your design is gentle and non-threatening to maximize patient comfort and safety.
Your role includes providing medical evaluations, first aid guidance, and emotional reassurance.
You can access your memories about users to provide personalized care.
You should be compassionate, helpful, and maintain a friendly demeanor.
Use straightforward, clear language suitable for healthcare contexts.`;
    }

    async processUserInput(userId, userInput) {
        try {
            // Get recent conversation history
            const recentConversations = this.memoryManager.getRecentConversations(userId, 5);
            const conversationHistory = recentConversations.map(item => ({
                role: "user",
                content: item.data.user
            })).concat(recentConversations.map(item => ({
                role: "assistant",
                content: item.data.bot
            }))).flat();
            
            // Get relevant user memories
            const userMemories = this.extractRelevantMemories(userId, userInput);
            
            // Build memory context
            let memoryContext = "";
            if (userMemories.length > 0) {
                memoryContext = "Relevant information about the user:\n" + 
                    userMemories.map(mem => `- ${mem.data.toString()}`).join("\n");
            }
            
            // Prepare message for the language model
            const messages = [
                {
                    role: "system",
                    content: `${this.systemContext}\n\n${memoryContext}`
                },
                ...conversationHistory,
                {
                    role: "user",
                    content: userInput
                }
            ];
            
            // Call the language model
            const completion = await websim.chat.completions.create({
                messages: messages
            });
            
            const response = completion.content;
            
            // Process response and update memories if needed
            this.updateMemoriesFromResponse(userId, userInput, response);
            
            return response;
        } catch (error) {
            console.error("Error processing with LLM:", error);
            return "I'm having trouble processing that right now. Could you try again?";
        }
    }

    extractRelevantMemories(userId, userInput) {
        // First, try to find directly relevant memories
        let relevantMemories = this.memoryManager.searchMemories(userId, userInput);
        
        // If no direct matches, extract key topics and try again
        if (relevantMemories.length === 0) {
            const keyTerms = this.extractKeyTerms(userInput);
            for (const term of keyTerms) {
                const results = this.memoryManager.searchMemories(userId, term);
                relevantMemories = relevantMemories.concat(results);
                
                // Limit to avoid too many irrelevant memories
                if (relevantMemories.length >= 5) break;
            }
        }
        
        // Sort by relevance and recency
        relevantMemories.sort((a, b) => {
            // Newer memories get priority
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        return relevantMemories.slice(0, 5); // Return top 5 most relevant memories
    }

    extractKeyTerms(text) {
        // Simple keyword extraction
        const commonWords = ["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "about", "is", "are", "was", "were"];
        
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));
    }

    updateMemoriesFromResponse(userId, userInput, response) {
        // Store the conversation
        this.memoryManager.addConversation(userId, userInput, response);
        
        // Check for potential memory updates
        const lowerResponse = response.toLowerCase();
        
        // Personal information pattern detection
        if (userInput.toLowerCase().includes("my name") || 
            userInput.toLowerCase().includes("call me") ||
            (lowerResponse.includes("name") && lowerResponse.includes("remember"))) {
            
            // Try to extract name
            const nameMatch = userInput.match(/my name is (\w+)|call me (\w+)/i);
            if (nameMatch) {
                const name = nameMatch[1] || nameMatch[2];
                this.memoryManager.setMemory(
                    userId, 
                    this.memoryManager.memoryTypes.PERSONAL, 
                    `User's name is ${name}`, 
                    'name'
                );
            }
        }
        
        // Medical information pattern detection
        if (userInput.toLowerCase().includes("symptom") || 
            userInput.toLowerCase().includes("pain") ||
            userInput.toLowerCase().includes("feeling")) {
            
            this.memoryManager.setMemory(
                userId,
                this.memoryManager.memoryTypes.MEDICAL,
                `User reported: ${userInput}`
            );
        }
        
        // Preference pattern detection
        if (userInput.toLowerCase().includes("prefer") || 
            userInput.toLowerCase().includes("like") ||
            userInput.toLowerCase().includes("enjoy")) {
            
            this.memoryManager.setMemory(
                userId,
                this.memoryManager.memoryTypes.PREFERENCE,
                `User preference: ${userInput}`
            );
        }
    }

    async generateImage(prompt) {
        try {
            const result = await websim.imageGen({
                prompt: prompt,
                aspect_ratio: "1:1"
            });
            
            return result.url;
        } catch (error) {
            console.error("Error generating image:", error);
            return null;
        }
    }
}

export default LLMService;

