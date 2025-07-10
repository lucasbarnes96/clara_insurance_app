// Create floating particles
function createParticles() {
    const particles = document.getElementById('particles');
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * 4 + 2;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
        
        particles.appendChild(particle);
    }
}

// Check system health
async function checkSystemHealth() {
    console.log('Starting health check...');
    
    try {
        console.log('Fetching health data...');
        const response = await fetch('/health');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const health = await response.json();
        console.log('Health check response:', health);
        
        // Update agents status
        const agentsEl = document.getElementById('agents-status');
        console.log('Agents element:', agentsEl);
        if (agentsEl) {
            const statusHtml = health.services && health.services.agents === 'healthy' 
                ? '<div class="status-dot"></div>Ready' 
                : '<div class="status-dot error"></div>Issues';
            agentsEl.innerHTML = statusHtml;
            console.log('Updated agents status to:', statusHtml);
        }
        
        // Update Firebase status
        const firebaseEl = document.getElementById('firebase-status');
        console.log('Firebase element:', firebaseEl);
        if (firebaseEl) {
            const statusHtml = health.services && health.services.firebase === 'healthy' 
                ? '<div class="status-dot"></div>Connected' 
                : '<div class="status-dot error"></div>Offline';
            firebaseEl.innerHTML = statusHtml;
            console.log('Updated firebase status to:', statusHtml);
        }
        
        // Update AI status (assume healthy if server is responding)
        const aiEl = document.getElementById('ai-status');
        console.log('AI element:', aiEl);
        if (aiEl) {
            aiEl.innerHTML = '<div class="status-dot"></div>Active';
            console.log('Updated AI status to Active');
        }
        
        // Update server status to connected
        const serverEl = document.getElementById('server-status');
        console.log('Server element:', serverEl);
        if (serverEl) {
            serverEl.innerHTML = '<div class="status-dot"></div>Connected';
            console.log('Updated server status to Connected');
        }
        
        console.log('Health check completed successfully');
        
    } catch (error) {
        console.error('Health check failed:', error);
        
        // Show error states
        const agentsEl = document.getElementById('agents-status');
        const firebaseEl = document.getElementById('firebase-status');
        const aiEl = document.getElementById('ai-status');
        const serverEl = document.getElementById('server-status');
        
        if (agentsEl) agentsEl.innerHTML = '<div class="status-dot error"></div>Error';
        if (firebaseEl) firebaseEl.innerHTML = '<div class="status-dot error"></div>Error';
        if (aiEl) aiEl.innerHTML = '<div class="status-dot error"></div>Error';
        if (serverEl) serverEl.innerHTML = '<div class="status-dot error"></div>Disconnected';
    }
}

// Initialize
function initializeApp() {
    console.log('Initializing app...');
    console.log('Document ready state:', document.readyState);
    
    createParticles();
    
    // Immediate test - set status manually first
    const agentsEl = document.getElementById('agents-status');
    const firebaseEl = document.getElementById('firebase-status');
    const aiEl = document.getElementById('ai-status');
    const serverEl = document.getElementById('server-status');
    
    console.log('Found elements:', { agentsEl, firebaseEl, aiEl, serverEl });
    
    if (agentsEl) {
        agentsEl.innerHTML = '<div class="status-dot"></div>Testing...';
        console.log('Set agents to testing...');
    }
    
    // Force immediate check
    setTimeout(() => {
        console.log('Running delayed health check...');
        checkSystemHealth();
    }, 1000);
    
    // Refresh every 30 seconds
    setInterval(checkSystemHealth, 30000);
}

// Multiple ways to ensure initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded
    setTimeout(initializeApp, 100);
}

// Backup initialization after window load
window.addEventListener('load', () => {
    console.log('Window loaded, running backup health check...');
    setTimeout(checkSystemHealth, 500);
});

// Add hover effects
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('.action-button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0) scale(1)';
        });
    });
}); 