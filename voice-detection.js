import * as pitchfinder from 'pitchfinder';

class VoiceDetection {
    constructor(memoryManager) {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isRecording = false;
        this.pitchDetector = null;
        this.voiceData = {
            pitches: [],
            avgPitch: 0,
            userIdentified: null
        };
        this.users = {};
        this.memoryManager = memoryManager;
        this.onSpeechEnd = null;
        this.speechTimeout = null;
        this.silenceThreshold = 0.01;
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.transcript = "";
    }

    async init() {
        try {
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.pitchDetector = pitchfinder.YIN();
            
            // Load stored user voice profiles
            this.loadUserProfiles();
            
            return true;
        } catch (error) {
            console.error("Error initializing voice detection:", error);
            return false;
        }
    }

    loadUserProfiles() {
        const storedUsers = this.memoryManager.getItem('voiceProfiles');
        if (storedUsers) {
            this.users = JSON.parse(storedUsers);
            console.log("Loaded voice profiles:", this.users);
        }
    }

    saveUserProfiles() {
        this.memoryManager.setItem('voiceProfiles', JSON.stringify(this.users));
    }

    async startListening(onSpeechEndCallback) {
        if (this.isRecording) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            // Set up speech recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    
                    if (event.results[i].isFinal) {
                        this.transcript += transcript + ' ';
                        this.resetSpeechTimeout();
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                // Update status to show what's being heard
                document.getElementById('status-message').textContent = "Hearing: " + (this.transcript + interimTranscript);
            };
            
            this.recognition.onend = () => {
                if (this.isRecording) {
                    this.recognition.start();
                }
            };
            
            this.recognition.start();
            
            // Set up pitch detection
            this.isRecording = true;
            this.onSpeechEnd = onSpeechEndCallback;
            this.recordedChunks = [];
            this.voiceData.pitches = [];
            this.transcript = "";
            
            // Start media recording for more detailed audio analysis
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            this.mediaRecorder.start();
            
            // Begin analyzing audio
            this.analyzePitch();
            
            // Initialize silence detection
            this.resetSpeechTimeout();
            
            return true;
        } catch (error) {
            console.error("Error starting microphone:", error);
            return false;
        }
    }

    stopListening() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        if (this.speechTimeout) {
            clearTimeout(this.speechTimeout);
        }
        
        // Process voice data for user identification
        this.identifyUser();
        
        // Call the speech end callback with the final transcript
        if (this.onSpeechEnd && this.transcript.trim() !== '') {
            this.onSpeechEnd(this.transcript.trim(), this.voiceData.userIdentified);
        }
        
        return this.transcript;
    }

    analyzePitch() {
        if (!this.isRecording) return;
        
        const bufferLength = this.analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(buffer);
        
        // Detect pitch
        const pitch = this.pitchDetector(buffer, {
            sampleRate: this.audioContext.sampleRate
        });
        
        if (pitch && !isNaN(pitch) && pitch > 0) {
            this.voiceData.pitches.push(pitch);
            this.resetSpeechTimeout();
            
            // Calculate average pitch from recent samples
            if (this.voiceData.pitches.length > 0) {
                const recentPitches = this.voiceData.pitches.slice(-20);
                this.voiceData.avgPitch = recentPitches.reduce((a, b) => a + b, 0) / recentPitches.length;
            }
        }
        
        // Detect audio level for silence detection
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += Math.abs(buffer[i]);
        }
        const average = sum / bufferLength;
        
        if (average > this.silenceThreshold) {
            this.resetSpeechTimeout();
            document.querySelector('.robot-face .mouth').classList.add('speaking');
        } else {
            document.querySelector('.robot-face .mouth').classList.remove('speaking');
        }
        
        requestAnimationFrame(() => this.analyzePitch());
    }

    resetSpeechTimeout() {
        if (this.speechTimeout) {
            clearTimeout(this.speechTimeout);
        }
        
        this.speechTimeout = setTimeout(() => {
            if (this.isRecording && this.transcript.trim() !== '') {
                this.stopListening();
            }
        }, 2000); // 2 seconds of silence triggers speech end
    }

    identifyUser() {
        if (this.voiceData.pitches.length < 10) {
            this.voiceData.userIdentified = "Unknown";
            return;
        }
        
        // Calculate the average pitch
        const avgPitch = this.voiceData.pitches.reduce((a, b) => a + b, 0) / this.voiceData.pitches.length;
        
        // Calculate pitch variance
        let variance = 0;
        for (const pitch of this.voiceData.pitches) {
            variance += Math.pow(pitch - avgPitch, 2);
        }
        variance /= this.voiceData.pitches.length;
        
        const voiceSignature = {
            avgPitch: avgPitch,
            variance: variance
        };
        
        // Try to identify the user
        let bestMatch = null;
        let bestScore = Number.MAX_VALUE;
        
        for (const userId in this.users) {
            const profile = this.users[userId];
            const pitchDiff = Math.abs(profile.avgPitch - voiceSignature.avgPitch);
            const varianceDiff = Math.abs(profile.variance - voiceSignature.variance);
            
            // Combined score (lower is better)
            const score = (pitchDiff / 50) + (varianceDiff / 5000);
            
            if (score < bestScore && score < 0.2) { // Threshold for considering a match
                bestScore = score;
                bestMatch = userId;
            }
        }
        
        if (bestMatch) {
            this.voiceData.userIdentified = bestMatch;
        } else {
            // New user detected
            const newUserId = `User${Object.keys(this.users).length + 1}`;
            this.users[newUserId] = voiceSignature;
            this.saveUserProfiles();
            this.voiceData.userIdentified = newUserId;
        }
        
        // Update the user identity display
        document.getElementById('user-identity').textContent = `User: ${this.voiceData.userIdentified}`;
        
        return this.voiceData.userIdentified;
    }
}

export default VoiceDetection;

