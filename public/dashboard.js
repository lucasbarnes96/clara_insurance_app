// Clara Insurance Dashboard - Human-in-the-Loop Approval Interface
// Completely refactored for escalation queue management while preserving all aesthetics

class ClaraDashboard {
    constructor() {
        this.socket = null;
        this.selectedEscalation = null;
        this.escalationQueue = [];
        this.lastUpdate = 0;
        
        this.init();
    }

    async init() {
        this.setupSocketConnection();
        this.setupEventListeners();
        this.setupResizers();
        await this.loadEscalationQueue();
        this.startPeriodicUpdates();
    }

    setupSocketConnection() {
        this.socket = io({
            transports: ['websocket'],
            upgrade: false
        });

        this.socket.on('connect', () => {
            console.log('Connected to Clara Insurance HITL Dashboard');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from operations');
            this.updateConnectionStatus(false);
        });

        // Listen for new escalations (real-time updates)
        this.socket.on('escalation_created', (escalation) => {
            console.log('New escalation received:', escalation);
            this.handleNewEscalation(escalation);
        });

        // Listen for workflow approvals (real-time updates)
        this.socket.on('workflow_approved', (data) => {
            console.log('Workflow approved:', data);
            this.handleWorkflowApproved(data.workflowId);
        });

        // Listen for dashboard data responses
        this.socket.on('dashboard_data', (data) => {
            console.log('Dashboard data received:', data);
            this.escalationQueue = data.escalations || [];
            this.lastUpdate = Date.now();
            this.renderEscalationQueue();
        });

        this.socket.on('dashboard_error', (error) => {
            console.error('Dashboard error:', error);
            this.showError(error.message);
        });
    }

    setupEventListeners() {
        // No chat functionality in HITL dashboard - removed all chat-related listeners
        // Dashboard is focused purely on escalation review and approval
    }

    setupResizers() {
        const leftResizer = document.getElementById('resizer-left-middle');
        const rightResizer = document.getElementById('resizer-middle-right');
        
        this.makeResizable(leftResizer, 'left');
        this.makeResizable(rightResizer, 'right');
    }

    makeResizable(resizer, side) {
        let isResizing = false;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        });

        const handleResize = (e) => {
            if (!isResizing) return;
            
            const container = document.querySelector('.dashboard-container');
            const rect = container.getBoundingClientRect();
            const percentage = ((e.clientX - rect.left) / rect.width) * 100;
            
            if (side === 'left') {
                const newLeftWidth = Math.max(20, Math.min(40, percentage));
                container.style.gridTemplateColumns = `${newLeftWidth}% 4px 1fr 4px 25%`;
            } else {
                const newRightWidth = Math.max(20, Math.min(40, 100 - percentage));
                const currentLeft = container.style.gridTemplateColumns.split(' ')[0] || '25%';
                container.style.gridTemplateColumns = `${currentLeft} 4px 1fr 4px ${newRightWidth}%`;
            }
        };

        const stopResize = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        };
    }

    // Hybrid approach: REST API for initial load, Socket.io for real-time updates
    async loadEscalationQueue() {
        try {
            const response = await fetch('/api/escalations');
            const data = await response.json();
            
            if (data.success) {
                this.escalationQueue = data.escalations || [];
                this.lastUpdate = Date.now();
                this.renderEscalationQueue();
                console.log('Escalation queue loaded:', this.escalationQueue.length, 'items');
            } else {
                throw new Error(data.error || 'Failed to load escalations');
            }
        } catch (error) {
            console.error('Failed to load escalation queue:', error);
            this.showError('Failed to load escalation queue');
        }
    }

    handleNewEscalation(escalation) {
        // Add new escalation to queue (real-time)
        this.escalationQueue.unshift(escalation);
        this.renderEscalationQueue();
        this.showNotification(`New escalation: ${escalation.escalationReason}`, 'info');
    }

    handleWorkflowApproved(workflowId) {
        // Remove approved workflow from queue (real-time)
        this.escalationQueue = this.escalationQueue.filter(esc => esc.workflowId !== workflowId);
        
        if (this.selectedEscalation && this.selectedEscalation.workflowId === workflowId) {
            this.selectedEscalation = null;
            this.renderCaseDetails();
        }
        
        this.renderEscalationQueue();
        this.showNotification('Workflow approved successfully', 'success');
    }

    renderEscalationQueue() {
        const escalationContainer = document.getElementById('escalation-queue');
        const queueCount = document.getElementById('queue-count');
        
        // Update queue count
        queueCount.textContent = this.escalationQueue.length;
        
        if (this.escalationQueue.length === 0) {
            escalationContainer.innerHTML = '<p style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">No pending escalations</p>';
            return;
        }

        const escalationHTML = this.escalationQueue.map(escalation => {
            const timeAgo = this.formatTimeAgo(escalation.createdAt);
            const customerName = `${escalation.customerData?.profile?.firstName || 'Unknown'} ${escalation.customerData?.profile?.lastName || 'Customer'}`;
            
            return `
                <div class="activity-item escalation-item" data-workflow-id="${escalation.workflowId}">
                    <div class="activity-header">
                        <span class="activity-agent">${customerName}</span>
                        <span>${timeAgo}</span>
                    </div>
                    <div class="activity-text">
                        ${escalation.workflowId}<br/>
                        <small style="color: white;">${escalation.escalationReason}</small>
                    </div>
                </div>
            `;
        }).join('');

        escalationContainer.innerHTML = escalationHTML;

        // Add click handlers for selection
        escalationContainer.querySelectorAll('.escalation-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectEscalation(item);
            });
        });
    }

    selectEscalation(item) {
        // Remove previous selection
        document.querySelectorAll('.activity-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        item.classList.add('selected');
        
        const workflowId = item.dataset.workflowId;
        this.selectedEscalation = this.escalationQueue.find(esc => esc.workflowId === workflowId);
        
        this.renderCaseDetails();
    }

    renderCaseDetails() {
        const detailsCanvas = document.getElementById('details-canvas');
        
        if (!this.selectedEscalation) {
            detailsCanvas.innerHTML = `
                <div class="placeholder">
                    <p>Select an escalation from the queue to view details and approve quotes.</p>
                </div>
            `;
            return;
        }

        const escalation = this.selectedEscalation;
        const customer = escalation.customerData;
        const insights = escalation.insights;
        const riskProfile = insights?.riskProfile;
        const recommendation = insights?.recommendation;
        const recommendedQuote = escalation.quotes.find(q => q.id === recommendation?.recommendedQuoteId);
        const otherQuotes = escalation.quotes.filter(q => q.id !== recommendation?.recommendedQuoteId);

        const html = `
            <div class="case-details">
                <div class="case-header">
                    <h3>Human-in-the-Loop Review</h3>
                    <div class="workflow-id">Workflow: ${escalation.workflowId}</div>
                    <div class="generated-by">Analysis by: ${insights?.generatedBy || 'Operations'} Agent</div>
                </div>

                <div class="detail-section customer-section">
                    <h4>Customer & Vehicle Data</h4>
                    <div class="detail-grid">
                        <div><strong>Name:</strong> ${customer.profile?.firstName || 'Unknown'} ${customer.profile?.lastName || 'Customer'}</div>
                        <div><strong>Age:</strong> ${this.calculateAge(customer.profile?.dateOfBirth) || 'Unknown'}${customer.profile?.dateOfBirth ? ` (${customer.profile.dateOfBirth})` : ''}</div>
                        <div><strong>Address:</strong> ${[customer.profile?.address?.street, customer.profile?.address?.city, customer.profile?.address?.state, customer.profile?.address?.zipCode].filter(Boolean).join(', ') || 'Unknown'}</div>
                        <div><strong>Vehicle:</strong> ${customer.vehicle?.year || 'Unknown'} ${customer.vehicle?.make || 'Unknown'} ${customer.vehicle?.model || 'Unknown'}</div>
                        <div><strong>Annual Usage:</strong> ${customer.vehicle?.annualUsage || 'Unknown'} km</div>
                        <div><strong>Parking:</strong> ${customer.vehicle?.parkingLocation || 'Unknown'}</div>
                        <div><strong>Violations:</strong> ${customer.profile?.driverLicense?.violations?.length || 0}</div>
                    </div>
                </div>

                <div class="detail-section quote-analysis-section">
                    <h4>Quote Analysis & Recommendation</h4>
                    <div class="quote-header">
                        <div class="quote-carrier">${recommendation?.recommendedCarrier || 'Unknown Carrier'}</div>
                        <div class="quote-premium">$${recommendedQuote?.totalPremium || 'TBD'}/year</div>
                    </div>
                    <div class="quote-reasoning">${recommendation?.reasoning || 'No reasoning provided'}</div>
                    <div class="quote-benefits">
                        <strong>Key Benefits:</strong>
                        <ul>
                            ${(recommendation?.keyBenefits || []).map(benefit => `<li>${benefit}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                ${otherQuotes.length > 0 ? `
                <div class="detail-section other-quotes-section">
                    <h4>Alternative Options <span class="toggle-quotes" data-action="toggle-quotes">▼ Show</span></h4>
                    <div class="other-quotes" id="other-quotes" style="display: none;">
                        ${otherQuotes.map(quote => `
                            <div class="alternative-quote">
                                <div><strong>${quote.carrier || 'Carrier'}:</strong> $${quote.totalPremium || 'TBD'}/year</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="action-section">
                    <button class="approve-button" data-workflow-id="${escalation.workflowId}" data-action="approve">
                        Approve
                    </button>
                    <button class="reject-button" data-workflow-id="${escalation.workflowId}" data-action="reject">
                        Decline
                    </button>
                </div>
            </div>
        `;

        detailsCanvas.innerHTML = html;
        
        // Add event listeners for buttons (CSP-compliant approach)
        this.setupCaseDetailEventListeners();
    }
    
    setupCaseDetailEventListeners() {
        // Add click handlers for approve/reject buttons
        const approveButton = document.querySelector('.approve-button');
        const rejectButton = document.querySelector('.reject-button');
        const toggleButton = document.querySelector('.toggle-quotes');
        
        if (approveButton) {
            approveButton.addEventListener('click', () => {
                const workflowId = approveButton.dataset.workflowId;
                this.approveWorkflow(workflowId);
            });
        }
        
        if (rejectButton) {
            rejectButton.addEventListener('click', () => {
                const workflowId = rejectButton.dataset.workflowId;
                this.rejectWorkflow(workflowId);
            });
        }
        
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleOtherQuotes();
            });
        }
    }
    
    toggleOtherQuotes() {
        const otherQuotes = document.getElementById('other-quotes');
        const toggle = document.querySelector('.toggle-quotes');
        
        if (otherQuotes && toggle) {
            if (otherQuotes.style.display === 'none') {
                otherQuotes.style.display = 'block';
                toggle.textContent = '▲ Hide';
            } else {
                otherQuotes.style.display = 'none';
                toggle.textContent = '▼ Show';
            }
        }
    }

    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return null;
        const birth = new Date(dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            return age - 1;
        }
        return age;
    }

    formatRiskLevel(riskLevel) {
        const levels = {
            low: '🟢 Low Risk',
            moderate: '🟡 Moderate Risk', 
            high: '🟠 High Risk',
            extreme: '🔴 Extreme Risk',
            unknown: '⚪ Unknown Risk'
        };
        return levels[riskLevel] || levels.unknown;
    }

    async approveWorkflow(workflowId) {
        try {
            console.log('Approving workflow:', workflowId);
            
            const response = await fetch(`/api/escalations/${workflowId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Quote approved and sent to customer', 'success');
                // Real-time update will be handled by socket event
            } else {
                throw new Error(result.error || 'Failed to approve workflow');
            }
        } catch (error) {
            console.error('Error approving workflow:', error);
            this.showError('Failed to approve workflow: ' + error.message);
        }
    }

    async rejectWorkflow(workflowId) {
        // Placeholder for reject functionality
        this.showNotification('Reject functionality not yet implemented', 'warning');
    }

    updateConnectionStatus(connected) {
        const statusDots = document.querySelectorAll('.status-dot');
        statusDots.forEach(dot => {
            dot.style.backgroundColor = connected ? 'var(--accent-tertiary)' : 'var(--accent-error)';
        });
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'var(--accent-error)' : 
                         type === 'warning' ? '#ff9500' : 
                         type === 'success' ? 'var(--accent-tertiary)' : 'var(--accent-primary)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    startPeriodicUpdates(interval = 60000) { // 1 minute intervals
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.loadEscalationQueue();
        }, interval);
    }
}

// Global functions for button actions
window.approveWorkflow = (workflowId) => {
    if (window.claraDashboard) {
        window.claraDashboard.approveWorkflow(workflowId);
    }
};

window.rejectWorkflow = (workflowId) => {
    if (window.claraDashboard) {
        window.claraDashboard.rejectWorkflow(workflowId);
    }
};

window.toggleOtherQuotes = () => {
    const quotesDiv = document.getElementById('other-quotes');
    const toggle = document.querySelector('.toggle-quotes');
    
    if (quotesDiv.style.display === 'none') {
        quotesDiv.style.display = 'block';
        toggle.textContent = '▲ Hide';
    } else {
        quotesDiv.style.display = 'none';
        toggle.textContent = '▼ Show';
    }
};

// Enhanced CSS for new functionality (preserving all original aesthetics)
const additionalCSS = `
    .case-details {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
        font-size: 0.85rem;
        line-height: 1.5;
        height: 100%;
        overflow-y: auto;
    }

    .case-header {
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .case-header h3 {
        color: white;
        margin-bottom: 4px;
    }

    .case-header h4 {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8rem;
    }

    .detail-section {
        margin-bottom: 20px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
    }

    .detail-section h4 {
        color: white;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }

    .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .detail-grid > div {
        padding: 4px 0;
    }

    .customer-section {
        border-left: 3px solid #007AFF;
    }

    .reason-section {
        border-left: 3px solid #007AFF;
    }

    .recommendation-section {
        border-left: 3px solid #007AFF;
    }

    .recommended-quote {
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 12px;
        border-radius: 6px;
        margin-top: 8px;
    }

    .quote-carrier {
        font-size: 1.1rem;
        font-weight: 600;
        color: white;
        margin-bottom: 4px;
    }

    .quote-premium {
        font-size: 1.3rem;
        font-weight: 700;
        color: #007AFF;
        margin-bottom: 8px;
    }

    .quote-reasoning {
        margin-bottom: 8px;
        font-style: italic;
        color: rgba(255, 255, 255, 0.7);
    }

    .quote-benefits, .confidence-score {
        margin-bottom: 4px;
        font-size: 0.8rem;
    }

    .other-quotes-section {
        border-left: 3px solid #007AFF;
    }

    .toggle-quotes {
        cursor: pointer;
        color: #007AFF;
        font-size: 0.8rem;
        user-select: none;
    }

    .toggle-quotes:hover {
        color: white;
    }

    .alternative-quote {
        padding: 8px;
        margin: 4px 0;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
    }

    .risk-section {
        border-left: 3px solid #007AFF;
    }

    .risk-summary {
        padding: 8px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        text-align: center;
        font-weight: 600;
    }

    .action-section {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 24px;
        padding: 20px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .approve-button, .reject-button {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 150px;
    }

    .approve-button {
        background: linear-gradient(135deg, #007AFF, #5856D6);
        color: white;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }

    .approve-button:hover {
        background: linear-gradient(135deg, #5856D6, #007AFF);
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4);
    }

    .reject-button {
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
    }

    .reject-button:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(255, 255, 255, 0.2);
    }

    .loading, .error {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        color: rgba(255, 255, 255, 0.7);
    }

    .error {
        color: white;
    }

    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    /* Preserve all original activity item styling for escalations */
    .escalation-item {
        border-left-color: #007AFF;
        background: rgba(255, 255, 255, 0.15);
    }

    .escalation-item:hover {
        background: rgba(255, 255, 255, 0.25);
    }

    .escalation-item.selected {
        background: linear-gradient(135deg, #007AFF, #5856D6);
        color: white;
    }

    .escalation-item.selected .activity-header {
        color: rgba(255, 255, 255, 0.8);
    }
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// No more global functions needed - using proper event listeners for CSP compliance

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.claraDashboard = new ClaraDashboard();
}); 