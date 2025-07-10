// Clara Insurance Voice-Enabled Customer Chat Interface

// Voice Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let isVoiceMode = false;

// Create background orbs
function createBackgroundOrbs() {
    const container = document.getElementById('background-orbs');
    const orbCount = 8;
    
    for (let i = 0; i < orbCount; i++) {
        const orb = document.createElement('div');
        orb.className = 'orb';
        
        const size = Math.random() * 200 + 100;
        orb.style.width = size + 'px';
        orb.style.height = size + 'px';
        orb.style.left = Math.random() * 100 + '%';
        orb.style.top = Math.random() * 100 + '%';
        orb.style.animationDelay = Math.random() * 15 + 's';
        orb.style.animationDuration = (Math.random() * 10 + 10) + 's';
        
        container.appendChild(orb);
    }
}

// Initialize Socket.IO and chat functionality
const socket = io();
let sessionId = null;

// Initialize session on page load
async function initializeSession() {
    try {
        const response = await fetch('/api/start-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        if (data.success) {
            sessionId = data.sessionId;
            console.log('Session initialized:', sessionId);
        } else {
            throw new Error(data.message || 'Failed to initialize session');
        }
    } catch (error) {
        console.error('Failed to initialize session:', error);
        addMessage('system', '⚠️ Failed to initialize session. Please refresh the page.');
    }
}

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const audioButton = document.getElementById('audio-button');
const typingIndicator = document.getElementById('typing');

// Socket event listeners
socket.on('connect', () => {
    console.log('Socket.io connected successfully');
    updateAudioButtonState();
});

socket.on('disconnect', () => {
    console.log('Socket.io disconnected');
    updateAudioButtonState();
});

socket.on('agent_response', (data) => {
    console.log('Received agent_response:', data);
    if (data.sessionId === sessionId) {
        addMessage('bot', data.content || data.message || 'I received your message!');
        hideTyping();
    }
});

socket.on('voice_response', (data) => {
    console.log('🎵 Received voice response from Clara');
    if (data.sessionId === sessionId) {
        // Convert base64 audio data back to blob and play
        const audioBlob = base64ToBlob(data.audioData, data.mimeType);
        playAudioBlob(audioBlob);
    }
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    hideTyping();
    addMessage('system', '⚠️ Error: ' + (error.message || 'Unknown error'));
});

// Initialize Web Audio API
async function initializeAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context initialized');
    } catch (error) {
        console.error('Failed to initialize audio context:', error);
    }
}

// Request microphone permission
async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            sendVoiceMessage(audioBlob);
            audioChunks = [];
        };
        
        console.log('Microphone permission granted');
        updateAudioButtonState();
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        addMessage('system', '🎤 Microphone access is required for voice interaction. Please enable it in your browser settings.');
        return false;
    }
}

// Convert audio blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Convert base64 to blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// Send voice message to server
async function sendVoiceMessage(audioBlob) {
    try {
        const base64Audio = await blobToBase64(audioBlob);
        
        console.log('🎤 Sending voice message...');
        showTyping();
        
        socket.emit('voice_message', {
            sessionId: sessionId,
            audioData: base64Audio,
            mimeType: 'audio/webm;codecs=opus'
        });
        
        // Voice messages route through CustomerAgent - response will show normally
        addMessage('user', '🎤 Voice message');
        
    } catch (error) {
        console.error('❌ Failed to send voice message:', error);
        addMessage('system', '⚠️ Failed to send voice message. Please try again.');
        hideTyping();
    }
}

// Play audio blob
function playAudioBlob(blob) {
    try {
        console.log('🎵 Playing Clara\'s audio response...');
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onloadeddata = () => {
            console.log('✅ Audio loaded, playing...');
            audio.play().catch(error => {
                console.error('❌ Failed to play audio:', error);
            });
        };
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            console.log('✅ Audio playback finished');
        };
        
        audio.onerror = (error) => {
            console.error('❌ Audio playback error:', error);
            URL.revokeObjectURL(audioUrl);
        };
        
    } catch (error) {
        console.error('❌ Failed to play audio blob:', error);
    }
}

// Voice messages now route through CustomerAgent - no session management needed

// Update audio button state
function updateAudioButtonState() {
    if (!audioButton) return;
    
    const microphoneIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C10.34 2 8.5 3.34 8.5 5V12C8.5 13.66 10.34 15 12 15C13.66 15 15.5 13.66 15.5 12V5C15.5 3.34 13.66 2 12 2Z" fill="#007AFF"/>
        <path d="M19.5 10V12C19.5 16.42 15.42 20.5 11 20.5H13C17.42 20.5 21.5 16.42 21.5 12V10H19.5Z" fill="#007AFF"/>
        <path d="M4.5 10V12C4.5 16.42 8.58 20.5 13 20.5H11C6.58 20.5 2.5 16.42 2.5 12V10H4.5Z" fill="#007AFF"/>
        <line x1="12" y1="20.5" x2="12" y2="24" stroke="#007AFF" stroke-width="3"/>
        <line x1="7" y1="24" x2="17" y2="24" stroke="#007AFF" stroke-width="3"/>
    </svg>`;
    
    if (isRecording) {
        audioButton.innerHTML = microphoneIcon;
        audioButton.classList.add('recording');
        audioButton.title = 'Stop recording';
    } else if (socket.connected && mediaRecorder) {
        audioButton.innerHTML = microphoneIcon;
        audioButton.classList.remove('recording');
        audioButton.title = 'Start voice recording';
    } else {
        audioButton.innerHTML = microphoneIcon;
        audioButton.classList.remove('recording');
        audioButton.title = 'Voice not available';
    }
}

// Toggle voice recording
async function toggleVoiceRecording() {
    if (!sessionId) {
        addMessage('system', '⚠️ Please wait for the session to initialize.');
        return;
    }

    if (!mediaRecorder) {
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) return;
    }

    if (isRecording) {
        // Stop recording
        mediaRecorder.stop();
        isRecording = false;
        console.log('Voice recording stopped');
    } else {
        // Start recording
        if (mediaRecorder.state === 'inactive') {
            mediaRecorder.start();
            isRecording = true;
            console.log('Voice recording started');
            showTyping();
        }
    }
    
    updateAudioButtonState();
}

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Send message on Enter (but not Shift+Enter)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = 'block';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function hideTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    console.log('=== SENDING MESSAGE ===');
    console.log('Message:', message);
    console.log('Session ID:', sessionId);
    
    // Add user message to chat
    addMessage('user', message);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Show typing indicator
    showTyping();
    
    // Send via Socket.IO
    const messageData = {
        sessionId: sessionId,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    socket.emit('customer_message', messageData);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    createBackgroundOrbs();
    messageInput.focus();
    
    // Initialize session
    initializeSession();
    
    // Initialize audio context
    initializeAudioContext();
    
    // Add event listeners
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('audio-button').addEventListener('click', toggleVoiceRecording);
    
    // Add event listeners for quick action buttons
    document.querySelectorAll('.quick-action').forEach(button => {
        button.addEventListener('click', function() {
            const message = this.getAttribute('data-message');
            if (message) {
                messageInput.value = message;
                sendMessage();
            }
        });
    });
    
    // Request microphone permission on first user interaction
    document.addEventListener('click', () => {
        if (!mediaRecorder) {
            requestMicrophonePermission();
        }
    }, { once: true });

    // Voice messages now route through CustomerAgent - no cleanup needed
}); 