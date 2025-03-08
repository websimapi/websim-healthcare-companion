class TTSService {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.voices = [];
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
        this.isSpeaking = false;

        // Event to handle when voices are loaded
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = this.setVoices.bind(this);
        }

        // Initial voice loading
        this.setVoices();
    }

    setVoices() {
        this.voices = this.synth.getVoices();
        
        // Try to find a friendly female voice
        let preferredVoice = this.voices.find(voice => 
            voice.name.includes('Female') || 
            voice.name.includes('Samantha') ||
            voice.name.includes('Victoria') ||
            voice.name.includes('Google UK English Female')
        );
        
        // Fallback to any English voice
        if (!preferredVoice) {
            preferredVoice = this.voices.find(voice => 
                voice.lang.includes('en-')
            );
        }
        
        // Fallback to any available voice
        this.voice = preferredVoice || (this.voices.length > 0 ? this.voices[0] : null);
    }

    // Speak the provided text
    speak(text, callback = null) {
        if (!this.synth || !text) return false;
        
        // Cancel any ongoing speech
        this.stop();
        
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure speech parameters
            utterance.voice = this.voice;
            utterance.rate = this.rate;
            utterance.pitch = this.pitch;
            utterance.volume = this.volume;
            
            // Handle events
            utterance.onstart = () => {
                this.isSpeaking = true;
                document.querySelector('.robot-face .mouth').classList.add('speaking');
            };
            
            utterance.onend = () => {
                this.isSpeaking = false;
                document.querySelector('.robot-face .mouth').classList.remove('speaking');
                if (callback) callback();
            };
            
            utterance.onerror = (event) => {
                console.error('TTS Error:', event);
                this.isSpeaking = false;
                document.querySelector('.robot-face .mouth').classList.remove('speaking');
                if (callback) callback(event);
            };
            
            // Start speaking
            this.synth.speak(utterance);
            return true;
        } catch (error) {
            console.error('Error using speech synthesis:', error);
            return false;
        }
    }

    // Stop any ongoing speech
    stop() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            document.querySelector('.robot-face .mouth').classList.remove('speaking');
        }
    }

    // Break long text into manageable chunks for better TTS
    speakLongText(text, callback = null) {
        if (!text || text.trim() === '') return;
        
        // Split text into sentences
        const sentences = text.split(/(?<=[.!?])\s+/);
        let currentIndex = 0;
        
        const speakNextChunk = () => {
            if (currentIndex < sentences.length) {
                const chunk = sentences[currentIndex];
                currentIndex++;
                
                this.speak(chunk, () => {
                    setTimeout(speakNextChunk, 100); // Small pause between sentences
                });
            } else if (callback) {
                callback();
            }
        };
        
        speakNextChunk();
    }

    // Set speech parameters
    setVoiceParameters(params = {}) {
        if (params.rate !== undefined) this.rate = Math.max(0.1, Math.min(2, params.rate));
        if (params.pitch !== undefined) this.pitch = Math.max(0, Math.min(2, params.pitch));
        if (params.volume !== undefined) this.volume = Math.max(0, Math.min(1, params.volume));
        
        if (params.voiceName && this.voices.length > 0) {
            const selectedVoice = this.voices.find(voice => voice.name === params.voiceName);
            if (selectedVoice) this.voice = selectedVoice;
        }
    }

    // Get available voices
    getAvailableVoices() {
        return this.voices.map(voice => ({
            name: voice.name,
            lang: voice.lang,
            default: voice.default
        }));
    }
}

export default TTSService;

