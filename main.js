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
        this.textInput = document.getElementById('text-input');
        this.sendTextBtn = document.getElementById('send-text-btn');
        this.guestUserSelect = document.getElementById('guest-user');
        
        // State
        this.currentUserId = "Guest";
        this.isProcessing = false;
        
        // Initialize
        this.init();
    }
    
    async init() {
        // Initialize services
        try {
            await this.voiceDetection.init();
        } catch (error) {
            console.error("Error initializing voice detection:", error);
            this.updateStatus("Voice recognition not available. You can still type your questions.");
        }
        
        // Set up event listeners
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.sendTextBtn.addEventListener('click', () => this.processTextInput());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processTextInput();
        });
        this.guestUserSelect.addEventListener('change', () => {
            this.currentUserId = this.guestUserSelect.value;
            this.userIdentity.textContent = `User: ${this.currentUserId}`;
        });
        
        // Welcome message
        this.updateStatus("I'm here to help you with healthcare and assistance. Please speak or type to me.");
        
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
        
        try {
            const success = await this.voiceDetection.startListening(
                (transcript, userId) => this.processVoiceInput(transcript, userId)
            );
            
            if (!success) {
                this.updateStatus("Could not access microphone. Please check your permissions or type your questions instead.");
                this.startBtn.disabled = false;
                this.stopBtn.disabled = true;
            }
        } catch (error) {
            console.error("Error starting voice detection:", error);
            this.updateStatus("Could not access microphone. Please type your questions instead.");
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
        this.currentUserId = userId || "Guest";
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
                this.updateStatus("I'm here to help you. Please speak or type to me.");
                
                // Re-enable listening if needed
                this.startBtn.disabled = false;
            });
        } catch (error) {
            console.error("Error processing voice input:", error);
            this.isProcessing = false;
            this.updateStatus("Sorry, I encountered an error. Please try again.");
            
            // Add error message to conversation
            this.addMessageToConversation("Sorry, I encountered an error. Please try again.", "bot");
            this.ttsService.speak("Sorry, I encountered an error. Please try again.");
        }
    }
    
    async processTextInput() {
        const text = this.textInput.value.trim();
        if (!text || this.isProcessing) return;
        
        this.isProcessing = true;
        this.updateStatus("Processing your request...");
        
        // Add user message to conversation
        this.addMessageToConversation(text, "user");
        
        try {
            // Get response from LLM
            const response = await this.llmService.processUserInput(this.currentUserId, text);
            
            // Add bot response to conversation
            this.addMessageToConversation(response, "bot");
            
            // Speak the response
            this.ttsService.speakLongText(response, () => {
                this.isProcessing = false;
                this.updateStatus("I'm here to help you. Please speak or type to me.");
            });
            
            // Clear the text input
            this.textInput.value = '';
        } catch (error) {
            console.error("Error processing text input:", error);
            this.isProcessing = false;
            this.updateStatus("Sorry, I encountered an error. Please try again.");
            
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