// Clara Insurance Customer Chat Interface

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
const typingIndicator = document.getElementById('typing');

// Socket event listeners
socket.on('connect', () => {
    console.log('Socket.io connected successfully');
});

socket.on('disconnect', () => {
    console.log('Socket.io disconnected');
});

socket.on('agent_response', (data) => {
    console.log('Received agent_response:', data);
    if (data.sessionId === sessionId) {
        addMessage('bot', data.content || data.message || 'I received your message!');
        hideTyping();
    }
});

socket.on('message', (data) => {
    console.log('Received message:', data);
    if (data.sessionId === sessionId) {
        addMessage('bot', data.message);
        hideTyping();
    }
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    hideTyping();
    addMessage('system', '⚠️ Error: ' + (error.message || 'Unknown error'));
});

socket.on('workflow_update', (data) => {
    if (data.sessionId === sessionId) {
        if (data.type === 'quote_generated') {
            addMessage('system', `✅ Quote Generated: $${data.data.monthlyPremium}/month`);
        } else if (data.type === 'escalated') {
            addMessage('system', '🔄 Transferred to human agent for complex inquiry');
        }
    }
});

socket.on('workflow_approved', (data) => {
    if (data.workflowId === sessionId) {
        addMessage('system', '✅ Your quotes have been approved! You can now ask me questions about your insurance options.');
        hideTyping();
    }
});

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
    typingIndicator.style.display = 'block';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTyping() {
    typingIndicator.style.display = 'none';
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    console.log('=== SENDING MESSAGE ===');
    console.log('Message:', message);
    console.log('Session ID:', sessionId);
    console.log('Socket connected:', socket.connected);
    console.log('Socket ID:', socket.id);
    
    // Add user message to chat
    addMessage('user', message);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Show typing indicator
    showTyping();
    
    // Send via Socket.IO (without workflowId initially - server will create it)
    const messageData = {
        sessionId: sessionId,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    console.log('Emitting customer_message with data:', messageData);
    socket.emit('customer_message', messageData);
    
    console.log('Message sent via socket.io');
    
    // Fallback timeout - if no response in 10 seconds, show a fallback message
    setTimeout(() => {
        if (typingIndicator.style.display === 'block') {
            console.log('Timeout reached - hiding typing indicator');
            hideTyping();
        }
    }, 10000);
}

function toggleAudio() {
    // Placeholder for future Gemini Live integration
    addMessage('system', '🎤 Live Audio feature coming soon with Gemini Live!');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    createBackgroundOrbs();
    messageInput.focus();
    
    // Initialize session
    initializeSession();
    
    // Add event listeners to replace inline onclick handlers
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('audio-button').addEventListener('click', toggleAudio);
    
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
    
    // Add smooth scroll behavior
    messagesContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 10;
        
        if (isNearBottom) {
            messagesContainer.style.scrollBehavior = 'smooth';
        }
    });
}); 