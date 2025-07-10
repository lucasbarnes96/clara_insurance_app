import { MemoryDataStore } from './memoryDataStore';
import { EventEmitter } from 'events';
import { Session } from '../types';

/**
 * Dashboard Service
 * Provides data and actions for the HITL dashboard.
 * Works with the simplified, Session-based MemoryDataStore.
 */
export class DashboardService extends EventEmitter {
  private static instance: DashboardService;
  private memoryStore: MemoryDataStore;

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  constructor() {
    super();
    this.memoryStore = MemoryDataStore.getInstance();
    this.setupDataStoreListeners();
    console.log('[DashboardService] Dashboard service initialized.');
  }

  private setupDataStoreListeners(): void {
    // Forward events from memory store to dashboard clients
    this.memoryStore.on('session_created', (session) => {
      this.emit('dashboard_update');
    });

    this.memoryStore.on('session_updated', (session) => {
      this.emit('dashboard_update');
    });
  }

  /**
   * Gets all sessions that require human attention.
   * This is our new "Escalation Queue".
   */
  public getPendingSessions(): Session[] {
    const allSessions = Array.from(this.memoryStore.getAllSessions().values());
    return allSessions.filter(s => s.status === 'pending_approval' || s.status === 'pending_rejection');
  }
  
  /**
   * Gets all active (i.e., not final state) sessions.
   */
  public getActiveSessions(): Session[] {
    const allSessions = Array.from(this.memoryStore.getAllSessions().values());
    const finalStates: (Session['status'])[] = ['approved', 'rejected'];
    return allSessions.filter(s => !finalStates.includes(s.status));
  }

  /**
   * Updates a session's status based on HITL action.
   */
  public updateSessionStatus(sessionId: string, newStatus: 'approved' | 'rejected'): { success: boolean, message: string } {
    const session = this.memoryStore.getSession(sessionId);
    if (!session) {
      return { success: false, message: 'Session not found.' };
    }

    if (session.status !== 'pending_approval' && session.status !== 'pending_rejection') {
        return { success: false, message: `Session is not pending review. Current status: ${session.status}` };
    }

    session.status = newStatus;
    session.isHumanApproved = newStatus === 'approved';
    session.updatedAt = new Date();
    
    this.memoryStore.updateSession(sessionId, session);
    
    console.log(`[DashboardService] ✅ Session ${sessionId} status updated to ${newStatus} by HITL.`);
    return { success: true, message: `Session status updated to ${newStatus}.` };
  }

  /**
   * Gets all data needed to render the dashboard.
   */
  public getDashboardData(): {
    pendingSessions: Session[];
    activeSessions: Session[];
    systemMetrics: {
        totalSessions: number;
        pendingReview: number;
    };
  } {
    const allSessions = Array.from(this.memoryStore.getAllSessions().values());
    const pendingSessions = allSessions.filter(s => s.status === 'pending_approval' || s.status === 'pending_rejection');
    const activeSessions = allSessions.filter(s => s.status !== 'approved' && s.status !== 'rejected');

    return {
        pendingSessions,
        activeSessions,
        systemMetrics: {
            totalSessions: allSessions.length,
            pendingReview: pendingSessions.length,
        }
    };
  }

  /**
   * Gets details for a single session.
   */
  public getSessionDetails(sessionId: string): Session | undefined {
    return this.memoryStore.getSession(sessionId);
  }
} 