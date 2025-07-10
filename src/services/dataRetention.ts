import { db } from './firebaseClient';
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs, 
    deleteDoc, 
    Timestamp,
    orderBy,
    limit,
    writeBatch,
    DocumentData,
    QueryDocumentSnapshot
} from 'firebase/firestore';

export interface BusinessEvent {
    id?: string;
    type: 'workflow_created' | 'stage_completed' | 'escalation_created' | 'quote_generated' | 'workflow_completed';
    workflowId: string;
    timestamp: Timestamp;
    stage?: string;
    agentType?: string;
    priority: 'low' | 'medium' | 'high';
    summary: string;
    essentialData: any; // Minimal business-critical data only
    retentionCategory: 'essential' | 'operational'; // essential = 7 days, operational = 24 hours
}

export interface WorkflowSummary {
    id?: string;
    workflowId: string;
    customerId: string;
    currentStage: string;
    status: 'active' | 'completed' | 'escalated' | 'abandoned';
    priority: 'low' | 'medium' | 'high';
    createdAt: Timestamp;
    lastUpdated: Timestamp;
    stageProgress: {
        customer_intake: { completed: boolean; completedAt?: Timestamp };
        quote_generation: { completed: boolean; completedAt?: Timestamp };
        finalization: { completed: boolean; completedAt?: Timestamp };
    };
    // Essential business data only
    customerProfile?: {
        name: string;
        contactMethod: string;
        location: string;
    };
    quotesSummary?: {
        count: number;
        priceRange: string;
        recommendedCarrier: string;
    };
    escalationReason?: string;
    agents: string[]; // Which agents touched this workflow
}

export interface SystemMetrics {
    id?: string;
    date: string; // YYYY-MM-DD format
    workflowsCreated: number;
    workflowsCompleted: number;
    escalationsCount: number;
    quotesGenerated: number;
    avgProcessingTime: number; // in minutes
    firestoreReads: number;
    firestoreWrites: number;
    sparkLimitStatus: 'safe' | 'warning' | 'critical';
}

class DataRetentionService {
    private readonly COLLECTIONS = {
        BUSINESS_EVENTS: 'business_events',
        WORKFLOW_SUMMARIES: 'workflow_summaries', 
        SYSTEM_METRICS: 'system_metrics',
        CUSTOMER_DATA: 'customer_data' // For temporary customer data during workflow
    };

    private readCount = 0;
    private writeCount = 0;

    // Track operations to stay within Spark limits
    private trackRead() {
        this.readCount++;
        if (this.readCount > 45000) { // Safety margin
            console.warn('Approaching daily read limit');
        }
    }

    private trackWrite() {
        this.writeCount++;
        if (this.writeCount > 18000) { // Safety margin
            console.warn('Approaching daily write limit');
        }
    }

    // Get current operation counts for monitoring
    getOperationCounts() {
        return {
            reads: this.readCount,
            writes: this.writeCount,
            readsRemaining: Math.max(0, 50000 - this.readCount),
            writesRemaining: Math.max(0, 20000 - this.writeCount)
        };
    }

    // Log essential business events only
    async logBusinessEvent(event: Omit<BusinessEvent, 'id' | 'timestamp'>): Promise<string> {
        this.trackWrite();
        
        const businessEvent: BusinessEvent = {
            ...event,
            timestamp: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, this.COLLECTIONS.BUSINESS_EVENTS), businessEvent);
        return docRef.id;
    }

    // Create or update workflow summary
    async upsertWorkflowSummary(summary: Omit<WorkflowSummary, 'id'>): Promise<void> {
        this.trackWrite();
        
        const docRef = doc(db, this.COLLECTIONS.WORKFLOW_SUMMARIES, summary.workflowId);
        await updateDoc(docRef, {
            ...summary,
            lastUpdated: Timestamp.now()
        }).catch(async () => {
            // Document doesn't exist, create it
            await addDoc(collection(db, this.COLLECTIONS.WORKFLOW_SUMMARIES), {
                ...summary,
                lastUpdated: Timestamp.now()
            });
        });
    }

    // Get active workflows for dashboard
    async getActiveWorkflows(): Promise<WorkflowSummary[]> {
        this.trackRead();
        
        const q = query(
            collection(db, this.COLLECTIONS.WORKFLOW_SUMMARIES),
            where('status', 'in', ['active', 'escalated']),
            orderBy('lastUpdated', 'desc'),
            limit(20) // Limit for Spark plan efficiency
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as WorkflowSummary));
    }

    // Get recent business events for dashboard activity stream
    async getRecentBusinessEvents(limitCount: number = 15): Promise<BusinessEvent[]> {
        this.trackRead();
        
        const q = query(
            collection(db, this.COLLECTIONS.BUSINESS_EVENTS),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as BusinessEvent));
    }

    // Get workflow details for dashboard details pane
    async getWorkflowDetails(workflowId: string): Promise<{
        summary: WorkflowSummary | null;
        recentEvents: BusinessEvent[];
    }> {
        this.trackRead(); // Only count once for the batch operation
        
        // Get workflow summary
        const summaryQuery = query(
            collection(db, this.COLLECTIONS.WORKFLOW_SUMMARIES),
            where('workflowId', '==', workflowId),
            limit(1)
        );
        const summarySnapshot = await getDocs(summaryQuery);
        const summary = summarySnapshot.empty ? null : 
            { id: summarySnapshot.docs[0].id, ...summarySnapshot.docs[0].data() } as WorkflowSummary;

        // Get recent events for this workflow
        const eventsQuery = query(
            collection(db, this.COLLECTIONS.BUSINESS_EVENTS),
            where('workflowId', '==', workflowId),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const recentEvents = eventsSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => 
            ({ id: doc.id, ...doc.data() } as BusinessEvent)
        );

        return { summary, recentEvents };
    }

    // Log daily system metrics
    async logDailyMetrics(metrics: Omit<SystemMetrics, 'id'>): Promise<void> {
        this.trackWrite();
        
        const docRef = doc(db, this.COLLECTIONS.SYSTEM_METRICS, metrics.date);
        await updateDoc(docRef, metrics).catch(async () => {
            await addDoc(collection(db, this.COLLECTIONS.SYSTEM_METRICS), metrics);
        });
    }

    // Cleanup old data (24-hour retention for operational, 7-day for essential)
    async performDataCleanup(): Promise<{
        operationalDeleted: number;
        essentialDeleted: number;
        quotaStatus: any;
    }> {
        const batch = writeBatch(db);
        let operationalDeleted = 0;
        let essentialDeleted = 0;

        // Calculate cutoff times
        const now = new Date();
        const operationalCutoff = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours
        const essentialCutoff = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days

        try {
            // Clean operational data (24-hour retention)
            this.trackRead();
            const operationalQuery = query(
                collection(db, this.COLLECTIONS.BUSINESS_EVENTS),
                where('retentionCategory', '==', 'operational'),
                where('timestamp', '<', Timestamp.fromDate(operationalCutoff))
            );
            const operationalSnapshot = await getDocs(operationalQuery);
            
            operationalSnapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
                batch.delete(doc.ref);
                operationalDeleted++;
            });

            // Clean essential data (7-day retention)
            this.trackRead();
            const essentialQuery = query(
                collection(db, this.COLLECTIONS.BUSINESS_EVENTS),
                where('retentionCategory', '==', 'essential'),
                where('timestamp', '<', Timestamp.fromDate(essentialCutoff))
            );
            const essentialSnapshot = await getDocs(essentialQuery);
            
            essentialSnapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
                batch.delete(doc.ref);
                essentialDeleted++;
            });

            // Clean completed workflows older than 7 days
            this.trackRead();
            const workflowQuery = query(
                collection(db, this.COLLECTIONS.WORKFLOW_SUMMARIES),
                where('status', '==', 'completed'),
                where('lastUpdated', '<', Timestamp.fromDate(essentialCutoff))
            );
            const workflowSnapshot = await getDocs(workflowQuery);
            
            workflowSnapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
                batch.delete(doc.ref);
            });

            // Execute batch delete
            if (operationalDeleted > 0 || essentialDeleted > 0 || !workflowSnapshot.empty) {
                this.trackWrite(); // Count batch as one write operation
                await batch.commit();
            }

        } catch (error) {
            console.error('Data cleanup failed:', error);
        }

        return {
            operationalDeleted,
            essentialDeleted,
            quotaStatus: this.getOperationCounts()
        };
    }

    // Check if we're approaching Spark plan limits
    checkSparkLimits(): {
        status: 'safe' | 'warning' | 'critical';
        reads: { used: number; limit: number; percentage: number };
        writes: { used: number; limit: number; percentage: number };
        recommendations: string[];
    } {
        const readPercentage = (this.readCount / 50000) * 100;
        const writePercentage = (this.writeCount / 20000) * 100;
        
        let status: 'safe' | 'warning' | 'critical' = 'safe';
        const recommendations: string[] = [];

        if (readPercentage > 90 || writePercentage > 90) {
            status = 'critical';
            recommendations.push('CRITICAL: Approaching daily limits. Consider data cleanup.');
        } else if (readPercentage > 75 || writePercentage > 75) {
            status = 'warning';
            recommendations.push('WARNING: High usage detected. Monitor closely.');
        }

        if (writePercentage > 80) {
            recommendations.push('Reduce logging frequency or batch operations.');
        }

        if (readPercentage > 80) {
            recommendations.push('Optimize dashboard queries and add caching.');
        }

        return {
            status,
            reads: { used: this.readCount, limit: 50000, percentage: readPercentage },
            writes: { used: this.writeCount, limit: 20000, percentage: writePercentage },
            recommendations
        };
    }
}

export const dataRetentionService = new DataRetentionService(); 