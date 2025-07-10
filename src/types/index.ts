// Mock Timestamp for in-memory demo mode (replaces Firebase dependency)
export interface MockTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: MockTimestamp): boolean;
  valueOf(): string; // Firebase Timestamp compatibility
}

// Use MockTimestamp instead of Firebase Timestamp for demo mode
export type Timestamp = MockTimestamp;

// Customer and Vehicle Types
export interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  address: {
    street: string;
    city: string;
    state: string; // Province or State abbreviation
    zipCode: string;
  };
  driverLicense: {
    violations: Violation[] | null;
  };
}

export interface Violation {
  type: 'speeding_minor' | 'speeding_major' | 'speeding_excessive' | 'careless_driving' | 'following_too_close' | 'improper_lane_change' | 'failure_to_yield' | 'at_fault_accident' | 'dui' | 'suspended_license' | 'unknown';
  description: string;
  date: string;
  isAtFault?: boolean;
}

export interface DriverViolation {
  type: 'speeding' | 'reckless_driving' | 'dui' | 'accident' | 'other';
  date: string;
  description: string;
  points: number;
}

export interface VehicleInfo {
  year: string;
  make: string;
  model: string;
  parkingLocation: 'garage' | 'driveway' | 'street' | '';
  annualUsage: number; // Annual usage in kilometers
  primaryUse: 'commute' | 'pleasure' | 'business' | 'commercial';
}

export interface CoveragePreferences {
  liability: {
    bodilyInjury: number;
    propertyDamage: number;
  };
  comprehensive: boolean;
  collision: boolean;
  uninsuredMotorist: boolean;
  personalInjuryProtection: boolean;
  rentalReimbursement: boolean;
  deductible: number;
}

// =================================================================
// ARCHITECTURAL REFACTOR (STATELESS) - NEW & REVISED TYPES
// =================================================================

// The intermediate risk factors calculated by the RiskEngine.
// This is used for internal calculations before being converted to final RatingFactors.
export interface RiskFactors {
  drivingHistoryScore: number;
  experienceScore: number;
  vehicleSafetyScore: number;
  usageScore: number;
  locationScore: number;
  reasoning: string[];
}

// The single, authoritative state for a customer interaction session.
// This is passed into the CustomerAgent, which acts as a pure function.
export interface Session {
  sessionId: string;
  workflowId?: string;
  customer: Customer; // Unifies business state and execution state
  conversationHistory: ChatMessage[];
  stage: 'greeting' | 'data_gathering' | 'confirmation' | 'handoff_complete' | 'quote_presentation';
  isHandoffComplete: boolean;
  isHumanApproved: boolean;
  rejectionReason?: string;
  status: 'data_gathering' | 'confirmation' | 'generating_quote' | 'pending_approval' | 'pending_rejection' | 'approved' | 'rejected';
  
  // Fields for OperationsAgent results
  riskFactors?: RiskFactors;
  riskMultiplier?: number;
  quotes?: QuoteDetails[];
  recommendation?: QuoteRecommendation;
  quoteAnalysis?: QuoteAnalysis;
  quoteData?: any; // To store quote results for presentation
  createdAt: Date;
  updatedAt: Date;
  // Optional, context-specific data gathered during the workflow
  finalRatingFactors?: RatingFactors; // Final, customer-facing factors
  riskProfileInsights?: RiskProfileInsights;
}

// Data structure for the in-memory store
export interface WorkflowData extends Session {
  // This can be extended with fields specific to the data store if needed,
  // but for now it can just inherit everything from Session.
}

// The output of the stateless CustomerAgent.processCustomerMessage function.
// Contains the updated session and the response to send to the user.
export interface SessionUpdate {
  session: Session;
  response: string;
}

// The complete, self-contained data package for a workflow.
// This is the "world state" passed to each agent for a given step.
export interface WorkflowContext {
  workflowId: string;
  customerId: string;
  session: Session;
  executionPlan: ExecutionPlan;
  currentStep: ExecutionStep;
  results: StepResult[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'escalated';
  // Optional, context-specific data gathered during the workflow
  riskFactors?: RiskFactors; // Intermediate factors
  riskProfileInsights?: RiskProfileInsights;
  quotes?: QuoteDetails[];
  quoteAnalysis?: QuoteAnalysis;
  escalationPackage?: EscalationPackage;
}

// Explicit data contract for the risk assessment step.
export interface RiskAssessmentContext {
  workflowId: string;
  stepId: string;
  customer: Customer;
}

// Explicit data contract for the quote generation step.
export interface QuoteGenerationContext {
  workflowId: string;
  stepId: string;
  customer: Customer;
  riskFactors: RiskFactors; // Use the intermediate factors for quote calculation
  riskProfileInsights: RiskProfileInsights;
  riskMultiplier: number;
}

// Result type for the risk assessment step.
export interface RiskAssessmentResult {
  riskFactors: RiskFactors; // Return the intermediate factors for the next step
  finalRatingFactors: RatingFactors; // Also return the final factors for storage
  riskProfileInsights: RiskProfileInsights;
  riskMultiplier: number;
  escalationRequired: {
    required: boolean;
    reason: string;
  };
}

// Result type for the quote generation step.
export interface QuoteGenerationResult {
  quotes: QuoteDetails[];
  quoteAnalysis: QuoteAnalysis;
  recommendation: QuoteRecommendation;
}

// =================================================================
// END ARCHITECTURAL REFACTOR
// =================================================================

// Rating and Quote Types
export interface RatingFactors {
  ageRating: number;
  experienceRating: number;
  locationRating: number;
  vehicleRating: number;
  creditRating: number;
  violationRating: number;
  coverageRating: number;
}

export interface QuoteDetails {
  id: string;
  customerId: string;
  carrier?: string;
  basePremium: number;
  discounts: Discount[];
  surcharges: Surcharge[];
  totalPremium: number;
  coverageDetails: CoverageDetails;
  effectiveDate: string;
  expirationDate: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued';
  generatedAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  features?: string[];
}

export interface Discount {
  type: string;
  description: string;
  amount: number;
  percentage: number;
}

export interface Surcharge {
  type: string;
  description: string;
  amount: number;
  percentage: number;
}

export interface CoverageDetails {
  liability: {
    bodilyInjuryPerPerson: number;
    bodilyInjuryPerAccident: number;
    propertyDamage: number;
    premium: number;
  };
  comprehensive: {
    deductible: number;
    premium: number;
  };
  collision: {
    deductible: number;
    premium: number;
  };
  uninsuredMotorist: {
    bodilyInjuryPerPerson: number;
    bodilyInjuryPerAccident: number;
    premium: number;
  };
}

// Agent Communication Types
export interface WorkflowExecution {
  id: string;
  sessionId: string;
  customerId: string;
  managerId: string;
  customerAgentId?: string;
  operationsAgentId?: string;
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'escalated';
  currentStep: number;
  totalSteps: number;
  plan: ExecutionPlan;
  results: StepResult[];
  escalationReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high';
}

export interface ExecutionStep {
  id: string;
  agentId: string;
  action: string;
  description: string;
  dependencies: string[];
  estimatedDuration: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failure' | 'partial';
  data: any;
  errors?: string[];
  duration: number;
  timestamp: Timestamp;
}

export interface AgentCommunication {
  id: string;
  workflowId: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'task_assignment' | 'status_update' | 'result_sharing' | 'escalation_request' | 'tool_call' | 'decision_point';
  payload: any;
  reasoning: string;
  timestamp: Timestamp;
  toolCalls?: ToolCall[];
  confidence: number;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
  result: any;
  duration: number;
  success: boolean;
  reasoning: string;
}

// Escalation Types - Manifesto-Compliant Structure
export interface RiskProfileInsights {
  keyFactors: string[]; // e.g., ["Young Driver", "Excellent Vehicle Safety"]
  summary: string;      // "A new driver with a very safe vehicle, resulting in a moderate risk profile."
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  confidenceScore: number; // 0.0 - 1.0
}

export interface QuoteAnalysis {
  recommendation: QuoteRecommendation;
  carrierPositioning: string; // "Economical is aggressive for this profile, while Intact is more conservative."
  pricingFactors: string[];   // e.g., ["Driving history is the main factor increasing the premium."]
  marketAnalysis: string;     // "Premium is 15% below market average for this risk profile."
  confidenceScore: number;    // 0.0 - 1.0
}

export interface EscalationPackageInsights {
  riskProfile: RiskProfileInsights;
  quoteAnalysis: QuoteAnalysis;
  generatedBy: 'operations'; // Always OperationsAgent per manifesto
  generatedAt: Date;
}

export interface EscalationPackage {
  workflowId: string;
  escalationReason: string;
  
  // RAW DATA - The Facts (collected by CustomerAgent, calculated by OperationsAgent)
  customerData: Customer;
  riskFactors: RatingFactors;
  quotes: QuoteDetails[];
  
  // INSIGHTS - The Story (Generated EXCLUSIVELY by OperationsAgent per manifesto)
  insights: EscalationPackageInsights;
  
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export interface QuoteRecommendation {
  recommendedCarrier: string;
  recommendedQuoteId: string;
  reasoning: string;
  confidence: number;
  keyBenefits: string[];
}

export interface EscalationQueue {
  id: string;
  workflowId: string;
  escalationType: 'quote_approval' | 'complex_case' | 'error_review' | 'compliance_check';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  customerContext: CustomerProfile;
  proposedAction: any;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated';
  assignedTo?: string;
  reviewComments?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  dueDate?: Timestamp;
}

// Customer and Interaction Types
export interface Customer {
  id: string;
  workflowId: string;
  sessionId: string;
  profile: CustomerProfile;
  vehicle: VehicleInfo;
  coveragePreferences: CoveragePreferences;
  ratingFactors: RatingFactors;
  quote?: QuoteDetails;
  interactions: InteractionLog[];
  complianceChecks: ComplianceRecord[];
  escalationHistory: EscalationRecord[];
  status: 'new' | 'in_progress' | 'quoted' | 'purchased' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InteractionLog {
  id: string;
  timestamp: Timestamp;
  type: 'customer_message' | 'agent_response' | 'system_action' | 'escalation' | 'approval';
  content: string;
  agentId?: string;
  metadata?: any;
}

export interface ComplianceRecord {
  id: string;
  checkType: string;
  status: 'passed' | 'failed' | 'pending' | 'review_required';
  details: string;
  timestamp: Timestamp;
  performedBy: string;
}

export interface EscalationRecord {
  id: string;
  type: string;
  reason: string;
  resolution: string;
  escalatedAt: Timestamp;
  resolvedAt?: Timestamp;
  escalatedBy: string;
  resolvedBy?: string;
}

// Agent Base Types
export interface AgentConfig {
  id: string;
  name: string;
  type: 'manager' | 'customer' | 'operations';
  capabilities: string[];
  maxConcurrentTasks: number;
  escalationThreshold: number;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  workflowId: string;
  fromAgent: string;
  toAgent?: string;
  messageType: string;
  payload: any;
  reasoning: string;
  timestamp: Date;
  requiresResponse: boolean;
}

// Frontend Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  attachments?: any[];
}

export interface AgentActivityItem {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  description: string;
  timestamp: Date;
  status: 'in_progress' | 'completed' | 'failed';
  details?: any;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

export interface DashboardState {
  activeWorkflows: WorkflowExecution[];
  agentActivities: AgentActivityItem[];
  escalationQueue: EscalationQueue[];
  systemMetrics: {
    activeAgents: number;
    completedTasks: number;
    averageResponseTime: number;
    escalationRate: number;
  };
} 