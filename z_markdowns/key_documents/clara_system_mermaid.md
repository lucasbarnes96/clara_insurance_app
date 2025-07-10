# Clara Insurance System Architecture & Workflow

This document contains comprehensive Mermaid diagrams that visualize the Clara Insurance system architecture, workflow, and key components based on the Trusted Expert Advisor manifesto and executive summary.

## System Architecture Overview

```mermaid
graph TB
    subgraph "Customer Interface"
        CI[Customer Interface<br/>Text & Voice Input]
        CV[Voice-to-Text<br/>Natural Language Processing]
    end
    
    subgraph "AI Agent Layer"
        CA[CustomerAgent<br/>Conversational Expert]
        OA[OperationsAgent<br/>Actuarial Intelligence]
        GS[GeminiService<br/>Gemini 2.5 Flash Engine]
    end
    
    subgraph "Deterministic Core"
        RE[RiskEngine<br/>Risk Calculations]
        QG[QuoteGenerator<br/>Carrier Quotes]
        AT[Actuarial Tables<br/>z_actuarial_data/]
    end
    
    subgraph "Human-in-the-Loop"
        HD[HITL Dashboard<br/>Expert Review]
        HE[Human Expert<br/>Final Decision]
    end
    
    subgraph "Data Layer"
        MDS[MemoryDataStore<br/>Demo Mode]
        FS[Firestore<br/>Production Mode]
    end
    
    CI --> CA
    CV --> CA
    CA --> GS
    OA --> GS
    CA <--> MDS
    OA <--> MDS
    OA --> RE
    OA --> QG
    RE --> AT
    QG --> AT
    OA --> HD
    HD --> HE
    HE --> CA
    MDS -.-> FS
    
    style CA fill:#e1f5fe
    style OA fill:#e8f5e8
    style GS fill:#fff3e0
    style AT fill:#f3e5f5
    style HD fill:#ffebee
```

## End-to-End Customer Journey

```mermaid
flowchart TD
    subgraph "Phase 1: Data Collection"
        A[Customer Initiates<br/>Conversation] --> B[CustomerAgent<br/>Greeting & Explanation]
        B --> C[Intelligent Data<br/>Extraction<br/>Text/Voice]
        C --> D[Data Confirmation<br/>& Go-Ahead]
    end
    
    subgraph "Phase 2: Automated Underwriting"
        D --> E[Central Orchestrator<br/>Handoff to OperationsAgent]
        E --> F{Hard Fork<br/>Risk Assessment}
        F -->|Low Risk| G[Generate Quotes<br/>Multiple Carriers]
        F -->|High Risk| H[Stop Processing<br/>No Quotes Generated]
        G --> I[AI Analysis<br/>Customer-Facing]
        H --> J[Rejection Summary<br/>Internal-Facing]
        I --> K[Approval Package<br/>to HITL Dashboard]
        J --> L[Rejection Package<br/>to HITL Dashboard]
    end
    
    subgraph "Phase 3: Human Review"
        K --> M[Human Expert<br/>Review Dashboard]
        L --> M
        M --> N{Expert Decision}
        N -->|Approve| O[Approve Quote]
        N -->|Reject| P[Reject Application]
    end
    
    subgraph "Phase 4: Quote Presentation"
        O --> Q[CustomerAgent<br/>Re-engaged]
        P --> Q
        Q --> R{Approved?}
        R -->|Yes| S[Present Final Quote<br/>with Insights]
        R -->|No| T[Communicate Decision<br/>Politely & Guide Next Steps]
    end
    
    style F fill:#fff3e0
    style M fill:#ffebee
    style N fill:#ffebee
    style Q fill:#e1f5fe
```

## Agent Architecture & Responsibilities

```mermaid
graph LR
    subgraph "CustomerAgent: Conversational Expert"
        CA1[Data Collection<br/>Essential Info Only]
        CA2[Voice Input<br/>Processing]
        CA3[Quote Presentation<br/>with Insights]
        CA4[Educational<br/>Explanations]
    end
    
    subgraph "OperationsAgent: Actuarial Intelligence"
        OA1[Risk Assessment<br/>Hard Fork Logic]
        OA2[Quote Generation<br/>Multiple Carriers]
        OA3[AI Analysis<br/>WHY Explanations]
        OA4[Package Creation<br/>Approval/Rejection]
    end
    
    subgraph "Core Principles"
        P1[Math is Sacred<br/>Deterministic Only]
        P2[AI Explains Math<br/>Never Modifies]
        P3[Stateless Design<br/>Complete I/O]
        P4[Human Review<br/>All Quotes]
    end
    
    CA1 --> OA1
    OA2 --> CA3
    OA3 --> CA4
    P1 --> OA1
    P2 --> OA3
    P3 --> CA1
    P3 --> OA1
    P4 --> OA4
    
    style CA1 fill:#e1f5fe
    style CA2 fill:#e1f5fe
    style CA3 fill:#e1f5fe
    style CA4 fill:#e1f5fe
    style OA1 fill:#e8f5e8
    style OA2 fill:#e8f5e8
    style OA3 fill:#e8f5e8
    style OA4 fill:#e8f5e8
    style P1 fill:#f3e5f5
    style P2 fill:#f3e5f5
    style P3 fill:#f3e5f5
    style P4 fill:#f3e5f5
```

## Deterministic Calculation Flow

```mermaid
flowchart TD
    subgraph "Customer Data Input"
        CD[Customer Profile<br/>Age, Location, Vehicle<br/>Usage, Violations]
    end
    
    subgraph "Actuarial Lookup Tables"
        AT1[Age Rating<br/>Table]
        AT2[Vehicle Rating<br/>Table]
        AT3[Location Rating<br/>Table]
        AT4[Usage Rating<br/>Table]
        AT5[Violation Rating<br/>Table]
    end
    
    subgraph "Risk Engine Process"
        RE1[Risk Score<br/>Calculation]
        RE2[Weighted Sum<br/>Algorithm]
        RE3[Base Premium<br/>Adjustment]
    end
    
    subgraph "Quote Generation"
        QG1[Carrier Appetite<br/>Tables]
        QG2[Focus Factor<br/>Application]
        QG3[Discount<br/>Calculation]
        QG4[Final Premium<br/>Math.ceil]
    end
    
    subgraph "AI Intelligence Layer"
        AI1[Risk Analysis<br/>Explanation]
        AI2[Carrier Selection<br/>Reasoning]
        AI3[Pricing Factor<br/>Insights]
        AI4[Customer Education<br/>Content]
    end
    
    CD --> AT1
    CD --> AT2
    CD --> AT3
    CD --> AT4
    CD --> AT5
    AT1 --> RE1
    AT2 --> RE1
    AT3 --> RE1
    AT4 --> RE1
    AT5 --> RE1
    RE1 --> RE2
    RE2 --> RE3
    RE3 --> QG1
    QG1 --> QG2
    QG2 --> QG3
    QG3 --> QG4
    QG4 --> AI1
    AI1 --> AI2
    AI2 --> AI3
    AI3 --> AI4
    
    style RE1 fill:#f3e5f5
    style RE2 fill:#f3e5f5
    style RE3 fill:#f3e5f5
    style QG4 fill:#f3e5f5
    style AI1 fill:#fff3e0
    style AI2 fill:#fff3e0
    style AI3 fill:#fff3e0
    style AI4 fill:#fff3e0
```

## HITL Dashboard System

```mermaid
graph TB
    subgraph "Dashboard Interface"
        EQ[Escalation Queue<br/>Pending Reviews]
        AA[Agent Activity<br/>System Events]
        WS[Workflow Stages<br/>Progress Tracking]
    end
    
    subgraph "Case Review Panel"
        CD[Customer Data<br/>Profile & Vehicle]
        QA[Quote Analysis<br/>Recommendations]
        AO[Alternative Options<br/>Other Carriers]
    end
    
    subgraph "Decision Actions"
        AB[Approve Button<br/>Send to Customer]
        DB[Decline Button<br/>Additional Review]
    end
    
    subgraph "Real-time Updates"
        WS1[Socket.io<br/>Live Updates]
        NE[New Escalations<br/>Notifications]
        WA[Workflow Approvals<br/>Status Changes]
    end
    
    EQ --> CD
    AA --> CD
    WS --> CD
    CD --> QA
    QA --> AO
    AO --> AB
    AO --> DB
    WS1 --> EQ
    WS1 --> AA
    NE --> EQ
    WA --> WS
    
    style EQ fill:#ffebee
    style AB fill:#e8f5e8
    style DB fill:#fff3e0
    style WS1 fill:#e1f5fe
```

## Data Flow & State Management

```mermaid
sequenceDiagram
    participant C as Customer
    participant CA as CustomerAgent
    participant O as Orchestrator
    participant OA as OperationsAgent
    participant RE as RiskEngine
    participant QG as QuoteGenerator
    participant H as HITL Dashboard
    participant E as Human Expert
    
    C->>CA: Start Conversation
    CA->>C: Collect Essential Data
    C->>CA: Provide Information
    CA->>C: Confirm & Request Go-Ahead
    C->>CA: Approve Processing
    
    CA->>O: Complete Data Package
    O->>OA: Handoff to Operations
    OA->>RE: Risk Assessment
    RE-->>OA: Risk Score
    
    alt Low Risk
        OA->>QG: Generate Quotes
        QG-->>OA: Multiple Carrier Quotes
        OA->>OA: Create Approval Package
        OA->>H: Send to Dashboard
    else High Risk
        OA->>OA: Create Rejection Package
        OA->>H: Send to Dashboard
    end
    
    H->>E: Present for Review
    E->>H: Approve/Reject Decision
    H->>CA: Update Status
    CA->>C: Present Final Result
    
    Note over CA,OA: All agents are stateless<br/>Complete context in/out
    Note over RE,QG: Deterministic calculations<br/>No AI modification
    Note over H,E: Human oversight<br/>All quotes reviewed
```

## Technology Stack & Integration

```mermaid
graph TB
    subgraph "Frontend Layer"
        HTML[HTML/CSS/JS<br/>Customer Interface]
        DASH[Dashboard<br/>Real-time UI]
        VOICE[Voice Input<br/>Speech-to-Text]
    end
    
    subgraph "Backend Services"
        SERVER[Express Server<br/>Node.js/TypeScript]
        SOCKET[Socket.io<br/>Real-time Updates]
        GEMINI[Gemini 2.5 Flash<br/>AI Reasoning Engine]
    end
    
    subgraph "Agent Layer"
        CUST[CustomerAgent.ts<br/>Conversation Management]
        OPS[OperationsAgent.ts<br/>Actuarial Processing]
        BASE[BaseAgent.ts<br/>Common Functionality]
    end
    
    subgraph "Business Logic"
        RATING[RiskEngine.ts<br/>Risk Calculations]
        QUOTE[QuoteGenerator.ts<br/>Carrier Quotes]
        TOOLS[Tools Directory<br/>Specialized Functions]
    end
    
    subgraph "Data Sources"
        TABLES[Actuarial Tables<br/>JSON Lookup Data]
        MEMORY[MemoryDataStore<br/>Session State]
        FIREBASE[Firebase/Firestore<br/>Production Data]
    end
    
    HTML --> SERVER
    DASH --> SOCKET
    VOICE --> SERVER
    SERVER --> CUST
    SERVER --> OPS
    CUST --> BASE
    OPS --> BASE
    BASE --> GEMINI
    OPS --> RATING
    OPS --> QUOTE
    RATING --> TABLES
    QUOTE --> TABLES
    CUST --> MEMORY
    OPS --> MEMORY
    MEMORY -.-> FIREBASE
    
    style GEMINI fill:#fff3e0
    style TABLES fill:#f3e5f5
    style MEMORY fill:#e1f5fe
    style FIREBASE fill:#e8f5e8
```

## Key Design Principles

```mermaid
mindmap
  root((Clara Insurance<br/>Design Principles))
    Trusted Expert Advisor
      Mathematical Precision
      Intelligent Insights
      Educational Value
    Hybrid Intelligence
      Deterministic Core
      AI Explanations
      Never Mixed
    Agentic Architecture
      CustomerAgent
      OperationsAgent
      Stateless Design
    Human Oversight
      All Quotes Reviewed
      Expert Validation
      Quality Assurance
    Efficiency
      Essential Data Only
      Streamlined Process
      Respectful of Time
    Reliability
      Predictable Workflow
      Linear Process
      Consistent Results
``` 