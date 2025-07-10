import { EventEmitter } from 'events';
import { 
  Customer, 
  Session,
  AgentCommunication, 
  EscalationQueue,
  AgentActivityItem,
  QuoteDetails
} from '../types';

/**
 * In-Memory Data Store Service
 * A simple in-memory store that holds the Session object.
 * Replaces Firebase for local demo/development.
 */
export class MemoryDataStore extends EventEmitter {
  private static instance: MemoryDataStore;
  
  private sessions: Map<string, Session> = new Map();
  private customers: Map<string, Customer> = new Map();
  
  public static getInstance(): MemoryDataStore {
    if (!MemoryDataStore.instance) {
      MemoryDataStore.instance = new MemoryDataStore();
    }
    return MemoryDataStore.instance;
  }

  constructor() {
    super();
    console.log('[MemoryDataStore] In-memory data store initialized.');
  }

  // Session Operations
  public createSession(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
    console.log(`[MemoryDataStore] Session created: ${sessionId}`);
    this.emit('session_created', session);
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public updateSession(sessionId: string, session: Session): void {
    if (this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, session);
      console.log(`[MemoryDataStore] Session updated: ${sessionId} - Status: ${session.status}`);
      this.emit('session_updated', session);
    }
  }

  public getAllSessions(): Map<string, Session> {
    return this.sessions;
  }

  // Customer Operations (can be simplified or integrated into Session if not used elsewhere)
  async createCustomer(customer: Customer): Promise<string> {
    this.customers.set(customer.id, customer);
    console.log(`[MemoryDataStore] Customer created: ${customer.id}`);
    return customer.id;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    return this.customers.get(customerId) || null;
  }
} 