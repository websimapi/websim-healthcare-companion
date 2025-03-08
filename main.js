// Import required modules
import VoiceDetection from './voice-detection.js';
import MemoryManager from './memory-manager.js';
import TTSService from './tts-service.js';
import LLMService from './llm-service.js';

class HealthcareCompanion {
    constructor() {
        // Initialize components
        this.memoryManager = new MemoryManager();
        this.voiceDetection = new VoiceDetection(this.memoryManager);
        this.ttsService = new TTSService();
        this.llmService = new LLMService(this.memoryManager);
        
        // UI elements
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.statusMessage = document.getElementById('status-message');
        this.userIdentity = document.getElementById('user-identity');
        this.conversationContainer = document.getElementById('conversation-container');
        
        // State
        this.currentUserId = "Unknown";
        this.isProcessing = false;
        
        // Initialize
        this.init();
    }
    
    async init() {
        // Initialize services
        await this.voiceDetection.init();
        
        // Set up event listeners
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        
        // Welcome message
        this.updateStatus("I'm here to help you with healthcare and assistance. Please speak to me.");
        
        // Speak welcome
        setTimeout(() => {
            this.ttsService.speak("Hello, I'm your healthcare companion. How can I assist you today?");
            this.addMessageToConversation("Hello, I'm your healthcare companion. How can I assist you today?", "bot");
        }, 1000);
    }
    
    async startListening() {
        if (this.isProcessing) return;
        
        this.updateStatus("Listening...");
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        
        const success = await this.voiceDetection.startListening(
            (transcript, userId) => this.processVoiceInput(transcript, userId)
        );
        
        if (!success) {
            this.updateStatus("Could not access microphone. Please check your permissions.");
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
        }
    }
    
    stopListening() {
        this.voiceDetection.stopListening();
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.updateStatus("Processing...");
    }
    
    async processVoiceInput(transcript, userId) {
        if (!transcript || this.isProcessing) return;
        
        this.isProcessing = true;
        this.currentUserId = userId || "Unknown";
        this.updateStatus("Processing your request...");
        
        // Update user identity display
        this.userIdentity.textContent = `User: ${this.currentUserId}`;
        
        // Add user message to conversation
        this.addMessageToConversation(transcript, "user");
        
        try {
            // Get response from LLM
            const response = await this.llmService.processUserInput(this.currentUserId, transcript);
            
            // Add bot response to conversation
            this.addMessageToConversation(response, "bot");
            
            // Speak the response
            this.ttsService.speakLongText(response, () => {
                this.isProcessing = false;
                this.updateStatus("I'm here to help you. Please speak to me.");
                
                // Re-enable listening if needed
                this.startBtn.disabled = false;
            });
        } catch (error) {
            console.error("Error processing voice input:", error);
            this.isProcessing = false;
            this.updateStatus("Sorry, I encountered an error. Please try again.");
            this.startBtn.disabled = false;
            
            // Add error message to conversation
            this.addMessageToConversation("Sorry, I encountered an error. Please try again.", "bot");
            this.ttsService.speak("Sorry, I encountered an error. Please try again.");
        }
    }
    
    updateStatus(message) {
        this.statusMessage.textContent = message;
    }
    
    addMessageToConversation(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}-message`;
        messageElement.textContent = message;
        
        this.conversationContainer.appendChild(messageElement);
        this.conversationContainer.scrollTop = this.conversationContainer.scrollHeight;
    }
}

// Initialize when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.healthcareCompanion = new HealthcareCompanion();
});

