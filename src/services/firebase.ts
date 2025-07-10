import * as admin from 'firebase-admin';
import { 
  Customer, 
  WorkflowExecution, 
  AgentCommunication, 
  EscalationQueue,
  AgentActivityItem,
  QuoteDetails
} from '@/types';

export class FirebaseService {
  private db: admin.firestore.Firestore;
  private static instance: FirebaseService;

  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        // We'll initialize with Firebase MCP server later
      });
    }
    this.db = admin.firestore();
  }

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  // Customer Operations
  async createCustomer(customer: Customer): Promise<string> {
    const docRef = await this.db.collection('customers').add({
      ...customer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    const doc = await this.db.collection('customers').doc(customerId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as Customer : null;
  }

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<void> {
    await this.db.collection('customers').doc(customerId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Workflow Operations
  async createWorkflow(workflow: Omit<WorkflowExecution, 'id'>): Promise<string> {
    const docRef = await this.db.collection('workflows').add({
      ...workflow,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async getWorkflow(workflowId: string): Promise<WorkflowExecution | null> {
    const doc = await this.db.collection('workflows').doc(workflowId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as WorkflowExecution : null;
  }

  async updateWorkflow(workflowId: string, updates: Partial<WorkflowExecution>): Promise<void> {
    await this.db.collection('workflows').doc(workflowId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async getActiveWorkflows(): Promise<WorkflowExecution[]> {
    const snapshot = await this.db
      .collection('workflows')
      .where('status', 'in', ['planning', 'executing'])
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowExecution));
  }

  // Agent Communication Operations
  async logAgentCommunication(communication: Omit<AgentCommunication, 'id'>): Promise<string> {
    const docRef = await this.db.collection('agent_communications').add({
      ...communication,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async getAgentCommunications(workflowId: string): Promise<AgentCommunication[]> {
    const snapshot = await this.db
      .collection('agent_communications')
      .where('workflowId', '==', workflowId)
      .orderBy('timestamp', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentCommunication));
  }

  async getRecentAgentActivities(limit: number = 20): Promise<AgentActivityItem[]> {
    const snapshot = await this.db
      .collection('agent_communications')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as AgentCommunication;
      return {
        id: doc.id,
        agentId: data.fromAgent,
        agentName: this.formatAgentName(data.fromAgent),
        action: data.messageType,
        description: data.reasoning,
        timestamp: data.timestamp.toDate(),
        status: 'completed',
        details: data.payload,
        toolCalls: data.toolCalls,
        reasoning: data.reasoning,
      } as AgentActivityItem;
    });
  }

  // Escalation Operations
  async createEscalation(escalation: Omit<EscalationQueue, 'id'>): Promise<string> {
    const docRef = await this.db.collection('escalation_queue').add({
      ...escalation,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async getEscalation(escalationId: string): Promise<EscalationQueue | null> {
    const doc = await this.db.collection('escalation_queue').doc(escalationId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as EscalationQueue : null;
  }

  async updateEscalation(escalationId: string, updates: Partial<EscalationQueue>): Promise<void> {
    await this.db.collection('escalation_queue').doc(escalationId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async getPendingEscalations(): Promise<EscalationQueue[]> {
    const snapshot = await this.db
      .collection('escalation_queue')
      .where('status', '==', 'pending')
      .limit(50)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscalationQueue));
  }

  // Quote Operations
  async saveQuote(quote: QuoteDetails): Promise<string> {
    const docRef = await this.db.collection('quotes').add({
      ...quote,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async getQuote(quoteId: string): Promise<QuoteDetails | null> {
    const doc = await this.db.collection('quotes').doc(quoteId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as QuoteDetails : null;
  }

  async updateQuoteStatus(quoteId: string, status: QuoteDetails['status'], approvedBy?: string): Promise<void> {
    const updates: any = { 
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (status === 'approved' && approvedBy) {
      updates.approvedAt = admin.firestore.FieldValue.serverTimestamp();
      updates.approvedBy = approvedBy;
    }
    
    await this.db.collection('quotes').doc(quoteId).update(updates);
  }

  // Real-time Subscriptions
  subscribeToWorkflowUpdates(workflowId: string, callback: (workflow: WorkflowExecution) => void): () => void {
    return this.db.collection('workflows').doc(workflowId).onSnapshot(doc => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() } as WorkflowExecution);
      }
    });
  }

  subscribeToAgentCommunications(workflowId: string, callback: (communications: AgentCommunication[]) => void): () => void {
    return this.db
      .collection('agent_communications')
      .where('workflowId', '==', workflowId)
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        const communications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentCommunication));
        callback(communications);
      });
  }

  subscribeToEscalationQueue(callback: (escalations: EscalationQueue[]) => void): () => void {
    return this.db
      .collection('escalation_queue')
      .where('status', '==', 'pending')
      .limit(50)
      .onSnapshot(snapshot => {
        const escalations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscalationQueue));
        callback(escalations);
      });
  }

  // Helper Methods
  private formatAgentName(agentId: string): string {
    const agentNames: { [key: string]: string } = {
      'manager': 'Manager Agent',
      'customer': 'Customer Agent', 
      'operations': 'Operations Agent',
    };
    return agentNames[agentId] || agentId;
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.collection('health').limit(1).get();
      return true;
    } catch (error) {
      console.error('Firebase health check failed:', error);
      return false;
    }
  }

  getDb(): admin.firestore.Firestore {
    return this.db;
  }
} 