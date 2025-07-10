# Clara Insurance: Firebase Spark Plan Compliance & Optimization

## Overview

This document outlines the redesigned Clara Insurance system optimized for Firebase Spark plan limits while maintaining essential business functionality and implementing workflow stage tracking.

## Firebase Spark Plan Limits

**Daily Quotas:**
- **Document Reads: 50,000/day** 
- **Document Writes: 20,000/day**
- **Document Deletes: 20,000/day**
- **Storage: 1 GiB total**
- **Outbound Transfer: 10 GiB/month**

**Critical Points:**
- Quotas reset daily around midnight Pacific time
- If exceeded, service shuts off for remainder of month
- No Cloud Functions available on Spark plan
- Need Blaze plan for advanced features (requires billing account)

## System Architecture Changes

### 1. Data Retention Strategy

**Two-Tier Retention System:**
- **Essential Data**: 7-day retention (critical business events)
- **Operational Data**: 24-hour retention (system events, detailed logs)

**Automated Cleanup:**
- Runs every 6 hours
- Removes old data to stay within storage limits
- Preserves only business-critical information

### 2. Optimized Data Structures

#### BusinessEvent (Essential Business Events Only)
```typescript
{
  type: 'workflow_created' | 'stage_completed' | 'escalation_created' | 'quote_generated' | 'workflow_completed',
  workflowId: string,
  timestamp: Timestamp,
  stage?: string,
  agentType?: string,
  priority: 'low' | 'medium' | 'high',
  summary: string,
  essentialData: any, // Minimal business-critical data only
  retentionCategory: 'essential' | 'operational' // essential = 7 days, operational = 24 hours
}
```

#### WorkflowSummary (CRM-Style Essential Data)
```typescript
{
  workflowId: string,
  customerId: string,
  currentStage: string,
  status: 'active' | 'completed' | 'escalated' | 'abandoned',
  priority: 'low' | 'medium' | 'high',
  stageProgress: {
    customer_intake: { completed: boolean, completedAt?: Timestamp },
    quote_generation: { completed: boolean, completedAt?: Timestamp },
    finalization: { completed: boolean, completedAt?: Timestamp }
  },
  customerProfile?: {
    name: string,
    contactMethod: string,
    location: string
  },
  quotesSummary?: {
    count: number,
    priceRange: string,
    recommendedCarrier: string
  },
  escalationReason?: string,
  agents: string[]
}
```

### 3. Dashboard Optimizations

#### **Left Pane Structure (As Requested):**
1. **Escalation Queue** (Upper Left)
   - Shows human escalations requiring attention
   - Click to view escalation details in middle pane

2. **Agent Activity** (Middle Left)
   - Recent business events and system activities
   - Click to view detailed context

3. **Workflow Stages** (Bottom Left) **[NEW]**
   - Shows active workflows with stage progress
   - Visual progress indicators (✅ completed, ⏳ pending)
   - Click for more details in middle pane

#### **Middle Pane: Details Canvas**
- Shows detailed information when items are selected
- Workflow details, stage progress, customer info
- Recent events for selected workflow
- Optimized queries to minimize reads

#### **Right Pane: Interactive Chat**
- Simplified AI chat (keyword-based responses)
- Quota monitoring and system insights
- No expensive AI API calls on Spark plan

### 4. Quota Management System

#### Real-time Monitoring
```typescript
// Operation tracking with safety margins
- Read limit: 45,000 (90% of 50,000)
- Write limit: 18,000 (90% of 20,000)
- Automatic warnings at 75% usage
- Critical alerts at 90% usage
```

#### Adaptive Behavior
- **Normal**: 30-second dashboard updates
- **Warning (75%+)**: Reduces to 60-second updates  
- **Critical (90%+)**: Reduces to 5-minute updates
- **Near Limit**: Suspends non-essential operations

## Operational Guidelines

### 1. Essential vs Operational Data Classification

**Essential Data (7-day retention):**
- Workflow creation/completion
- Stage completions
- Quote generation results
- Customer escalations
- Business outcomes

**Operational Data (24-hour retention):**
- Agent communications
- System debugging info
- Performance metrics
- Detailed reasoning logs

### 2. Dashboard Usage Best Practices

**For Insurance Domain Experts:**
- Focus on workflow stages section for process visibility
- Use escalation queue for priority management
- Click items for business context, not technical details
- Chat feature provides quota status and system insights

**For Developers:**
- Monitor quota usage via chat: "quota status"
- Review system metrics: "system status"
- Escalation tracking: "escalation status"
- Use detailed views sparingly to preserve reads

### 3. Data Cleanup Schedule

**Automatic Cleanup (Every 6 hours):**
- Removes operational data >24 hours old
- Removes essential data >7 days old
- Removes completed workflows >7 days old
- Logs cleanup results and quota status

**Manual Cleanup (If needed):**
```typescript
// Emergency quota preservation
await dataRetentionService.performDataCleanup();
```

## Business Intelligence Focus

### 1. Workflow Stage Tracking

**Three-Stage Process Visibility:**
1. **Customer Intake**: Data collection and validation
2. **Quote Generation**: Risk assessment and pricing
3. **Finalization**: Quote delivery and customer response

**Progress Indicators:**
- ✅ Stage completed with timestamp
- ⏳ Stage in progress
- Visual timeline of workflow progression

### 2. Escalation Management

**Human Escalation Triggers:**
- High-risk customer profiles
- Complex insurance scenarios
- System failure recovery
- Quality assurance flags

**Escalation Data:**
- Customer context
- Escalation reason
- Agent recommendations
- Priority level

### 3. Business Metrics

**Key Performance Indicators:**
- Workflows created/completed per day
- Average processing time
- Escalation rate
- Quote conversion rate
- System quota utilization

## Technical Implementation

### 1. Server Integration

```typescript
// Dashboard service integration
import { dashboardService } from './services/dashboardService';

// Log workflow events
await dashboardService.logWorkflowCreation(workflowId, customerName, location);
await dashboardService.logStageCompletion(workflowId, 'customer_intake', 'CustomerAgent', summary);
await dashboardService.logQuoteGeneration(workflowId, 3, '$150-$300/month', 'Intact');
await dashboardService.broadcastEscalation({
    workflowId,
    summary: 'High-risk profile requires human review',
    priority: 'high',
    reason: 'Multiple violations detected',
    agentType: 'OperationsAgent'
});
```

### 2. Agent Integration

```typescript
// In agents, replace detailed logging with essential events
// OLD: Log every communication
await firebase.logAgentCommunication({...});

// NEW: Log only essential business events
await dashboardService.logStageCompletion(
    workflowId, 
    'customer_intake', 
    'CustomerAgent',
    'Customer data collection completed successfully'
);
```

### 3. Quota Monitoring

```typescript
// Check quota status
const quotaStatus = dataRetentionService.checkSparkLimits();
console.log(`Quota: ${quotaStatus.reads.percentage}% reads, ${quotaStatus.writes.percentage}% writes`);

// Get operation counts
const counts = dataRetentionService.getOperationCounts();
console.log(`Operations today: ${counts.reads} reads, ${counts.writes} writes`);
```

## Migration Checklist

### Immediate Actions:
- [ ] Install Firebase client SDK: `npm install firebase`
- [ ] Configure Firebase client credentials in environment
- [ ] Update dashboard.html to use new dashboard system
- [ ] Test workflow stage tracking functionality

### System Integration:
- [ ] Update agent classes to use dashboardService instead of direct Firebase logging
- [ ] Implement essential event logging in workflow transitions
- [ ] Set up automated data cleanup schedule
- [ ] Configure quota monitoring alerts

### Business Process:
- [ ] Train domain experts on new dashboard sections
- [ ] Establish escalation response procedures
- [ ] Define acceptable quota usage thresholds
- [ ] Create backup procedures for quota exceeded scenarios

## Monitoring & Alerts

### Dashboard Notifications:
- **Info**: System status and workflow updates
- **Warning**: Approaching quota limits (75%+)
- **Error**: Critical quota usage (90%+) or escalations

### Chat Commands:
- `"quota status"` - Current Firestore usage
- `"workflow status"` - Active workflow count
- `"escalation status"` - Recent escalations
- `"help"` - Available commands

## Disaster Recovery

### If Quota Exceeded:
1. **Immediate**: Dashboard switches to read-only mode
2. **Automatic**: Cleanup service runs emergency data purge
3. **Manual**: Review and delete non-essential data
4. **Next Day**: Service resumes with quota reset

### Backup Strategy:
- Essential data retained for 7 days maximum
- Manual export capability for critical workflows
- Escalation queue preserved as highest priority
- Customer contact information always retained

## Future Considerations

### Potential Blaze Plan Migration:
- When ready for Cloud Functions and higher quotas
- Enables advanced AI integration and real-time processing
- Allows for more detailed logging and analytics
- Required for production-scale operations

### Current Spark Plan Benefits:
- Zero infrastructure costs
- Forces efficient data design
- Encourages essential-only information capture
- Perfect for MVP and demonstration purposes

---

**System Status**: Optimized for Firebase Spark Plan ✅  
**Business Focus**: Insurance workflow visibility and escalation management ✅  
**Technical Focus**: Quota compliance and essential data retention ✅ 