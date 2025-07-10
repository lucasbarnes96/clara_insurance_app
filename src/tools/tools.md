# Clara Insurance Platform - Tools & Services Documentation

**Document Status**: Current & Aligned with Deterministic Actuarial System (v4)

This document provides a comprehensive catalog of the deterministic tools and services available to agents within the Clara Insurance multi-agent platform.

## Architecture: Deterministic Core + Intelligent Insights

Our system is built on a service-oriented architecture where a central **deterministic core** provides 100% predictable mathematical calculations. The AI's role is exclusively to provide intelligent insights *about* these deterministic results, not to modify them. This separation is a foundational principle of the Clara platform.

### The Deterministic Core

#### `ActuarialService`
- **Location**: `src/services/actuarialService.ts`
- **Purpose**: This service is the **single source of truth** for all mathematical and actuarial calculations. It loads and manages all lookup tables from the `z_actuarial_data/` directory, ensuring that all rating logic is centralized, version-controlled, and completely deterministic.
- **Key Methods**:
  - `getExperienceFactor()`: Calculates the age-based experience factor.
  - `getVehicleSafetyFactor()`: Calculates the make/model/year-based vehicle safety factor.
  - `getLocationFactor()`: Calculates the geography and parking-based location factor.
  - `getUsageFactor()`: Calculates the usage-based factor from annual kilometers.
  - `getDrivingHistoryFactor()`: Scores violations, applies decay rules, and checks for escalation triggers.
  - `calculateRiskMultiplier()`: Combines all factors using the officially mandated weights.
- **Used By**: `RiskEngine`, `QuoteGenerator`. (Note: Agents do not call this service directly; they use the specialist tools below).

### Specialist Tools (Deterministic Wrappers)

Specialist tools act as simple, deterministic wrappers that orchestrate calls to the `ActuarialService`. They contain **no** independent mathematical or AI logic.

#### `RiskEngine` Tool
- **Location**: `src/tools/riskEngine.ts`
- **Purpose**: A deterministic tool that performs a complete risk assessment by orchestrating calls to the `ActuarialService`.
- **Key Methods**:
  - `calculateRiskFactors()`: Calls the `ActuarialService` to get all five core risk factors.
  - `calculateRiskMultiplier()`: A pass-through call to the `ActuarialService`.
  - `checkForEscalation()`: Checks for deterministic escalation triggers (e.g., DUI, multiple at-fault accidents) based on rules within the `ActuarialService`.
- **Used By**: `OperationsAgent`

#### `QuoteGenerator` Tool
- **Location**: `src/tools/quoteGenerator.ts`
- **Purpose**: A deterministic tool that generates competitive quotes using the risk profile calculated by the `RiskEngine` and the carrier appetites defined in the `ActuarialService`.
- **Key Methods**:
  - `generateQuotes()`: Creates quotes for all supported carriers.
  - `generateCarrierQuote()`: Calculates a carrier-specific premium using their unique focus factors, multipliers, and discount rules as provided by the `ActuarialService`.
- **Supported Carriers**:
  - Intact Insurance
  - Aviva Canada
  - Economical Insurance
- **Used By**: `OperationsAgent`

### Agent Integration Example

The `OperationsAgent` strictly follows the "calculate first, then analyze" model. It uses the deterministic tools to get the numbers, and only then uses its AI "brain" (`GeminiService`) to understand and explain the results.

```typescript
// Stage 1: DETERMINISTIC CALCULATION (using tools that call ActuarialService)
const riskFactors = await this.riskEngine.calculateRiskFactors(customer);
const riskMultiplier = this.riskEngine.calculateRiskMultiplier(riskFactors);
const { quotes } = await this.quoteGenerator.generateQuotes(customer, adjustedBasePremium, riskFactors);

// Stage 2: INTELLIGENT INSIGHTS (using the Gemini brain to explain the math)
const recommendation = await this.analyzeGeneratedQuotes(quotes, customer, riskFactors);
```

### Benefits of This Architecture
1.  **100% Predictability**: All math is centralized in the `ActuarialService` and its data tables. The results are repeatable and auditable.
2.  **Separation of Concerns**: Mathematical precision is completely isolated from AI-powered communication and reasoning.
3.  **Testability**: The deterministic actuarial engine can be unit tested independently of any agent logic.
4.  **Maintainability**: Changes to rating logic only need to happen in the actuarial tables and the `ActuarialService`, not in the agent code.

## Service Architecture

### Core Services

#### `RiskEngine` Service
- **Location**: `src/services/riskEngine.ts` (future, placeholder)
- **Purpose**: Handles all risk assessment and rating calculations
- **Key Methods**:
  - `calculateRiskFactors()` - Performs 5-factor risk assessment
  - `calculateRiskMultiplier()` - Combines factors into overall risk score
  - `checkForEscalation()` - Determines if human review is required
  - `getRiskDescription()` - Provides human-readable risk level
- **Risk Factors Evaluated**:
  - Driving History (40% weight) - Recent violations and accidents
  - Driver Experience (25% weight) - Age and license experience
  - Vehicle Safety (20% weight) - Make/model safety ratings using LLM knowledge
  - Annual Usage (10% weight) - Mileage-based risk assessment
  - Location Risk (5% weight) - Geographic risk factors for Canadian cities
- **Used By**: OperationsAgent

#### `QuoteGenerator` Service
- **Location**: `src/services/quoteGenerator.ts`
- **Purpose**: Generates competitive quotes from multiple Canadian carriers
- **Key Methods**:
  - `generateQuotes()` - Creates 3 carrier quotes with recommendations
- **Supported Carriers**:
  - **Intact Insurance** (Conservative appetite) - Higher premiums, comprehensive coverage
  - **Aviva Canada** (Balanced appetite) - Market competitive with flexible options  
  - **Economical Insurance** (Aggressive appetite) - Lowest pricing, essential coverage
- **Quote Features**:
  - Carrier-specific pricing strategies and coverage options
  - Intelligent recommendations based on customer profile
  - Detailed coverage breakdowns and feature comparisons
- **Used By**: OperationsAgent

### Legacy Tool Categories (Maintained for Reference)

#### 1. Customer Verification & Identity Tools

##### `customer_verification`
- **Purpose**: Verify customer identity and collect basic authentication data
- **Input Parameters**: 
  - `workflowId`: String - Workflow identifier for tracking
  - `profile`: Object - Customer profile data for verification
- **Expected Output**:
  ```json
  {
    "verified": boolean,
    "score": number (0.0-1.0),
    "flags": string[] - Any verification concerns
  }
  ```
- **Used By**: CustomerAgent, OperationsAgent
- **Execution Time**: ~500-1500ms
- **Success Criteria**: Verification score > 0.8, no blocking flags

#### 2. Vehicle Assessment Tools

##### `vehicle_lookup`
- **Purpose**: Retrieve comprehensive vehicle information and specifications
- **Note**: In MVP implementation, this is handled by RiskEngine using LLM knowledge
- **Input Parameters**:
  - `vin`: String - Vehicle Identification Number
  - `make`: String - Vehicle manufacturer
  - `model`: String - Vehicle model
  - `year`: Number - Model year
- **Expected Output**:
  ```json
  {
    "vehicleData": {
      "safetyRating": number (1-10),
      "marketValue": number,
      "theftRisk": "low" | "medium" | "high"
    }
  }
  ```
- **Used By**: OperationsAgent (via RiskEngine)

#### 3. Driver History & Risk Assessment Tools

##### `driver_history_check`
- **Purpose**: Analyze complete driving record and violation history
- **Note**: In MVP implementation, this is handled by RiskEngine
- **Input Parameters**:
  - `profile`: Object - Driver profile with license information
  - `licenseNumber`: String - Driver's license number
  - `state`: String - License issuing state
  - `dateRange`: String - Period to analyze (default: 5 years)
- **Expected Output**:
  ```json
  {
    "violations": array,
    "licenseStatus": "valid" | "suspended" | "expired",
    "experienceYears": number,
    "riskScore": number (0.0-1.0)
  }
  ```
- **Used By**: OperationsAgent (via RiskEngine)

#### 4. Geographic & Location Risk Tools

##### `geographic_risk_analysis`
- **Purpose**: Assess location-based risk factors for insurance pricing
- **Note**: In MVP implementation, this uses LLM knowledge of Canadian geography
- **Input Parameters**:
  - `address`: Object - Complete customer address
  - `zipCode`: String - Primary location identifier
  - `parkingLocation`: String - Vehicle storage type
- **Expected Output**:
  ```json
  {
    "riskMultiplier": number,
    "territoryCode": string,
    "riskLevel": "low" | "medium" | "high"
  }
  ```
- **Used By**: OperationsAgent (via RiskEngine)

#### 5. Rating & Calculation Tools

##### `rate_calculation`
- **Purpose**: Perform comprehensive premium calculations using risk engine
- **Implementation**: Now handled by RiskEngine and QuoteGenerator services
- **Input Parameters**:
  - `customer`: Object - Complete customer profile
  - `vehicle`: Object - Vehicle information
  - `coverage`: Object - Selected coverage options
  - `riskFactors`: Object - All calculated rating factors
- **Expected Output**:
  ```json
  {
    "basePremium": number,
    "factors": object,
    "adjustedPremium": number,
    "breakdown": object
  }
  ```
- **Used By**: OperationsAgent (via RiskEngine/QuoteGenerator)

#### 6. Quote Generation & Comparison Tools

##### `multi_carrier_quote_generation`
- **Purpose**: Generate competitive quotes from multiple carriers
- **Implementation**: Now handled by QuoteGenerator service
- **Carriers Supported**:
  - Intact Insurance (Conservative appetite)
  - Aviva Canada (Balanced appetite)
  - Economical Insurance (Aggressive appetite)
- **Features**:
  - Carrier-specific pricing strategies
  - Coverage differentiation
  - Intelligent recommendations
  - Customer profile matching
- **Used By**: OperationsAgent (via QuoteGenerator)

#### 7. Compliance & Regulatory Tools

##### `compliance_check`
- **Purpose**: Validate quotes against all applicable regulations
- **Input Parameters**:
  - `quote`: Object - Complete quote details
  - `customer`: Object - Customer profile
  - `state`: String - Regulatory jurisdiction
- **Expected Output**:
  ```json
  {
    "compliant": boolean,
    "violations": string[],
    "warnings": string[],
    "certificationRequired": boolean
  }
  ```
- **Used By**: OperationsAgent, ManagerAgent
- **Regulatory Sources**: Provincial insurance regulations, company guidelines
- **Escalation**: Auto-escalate any compliance violations

#### 8. Coverage Consultation Tools

##### `coverage_consultation`
- **Purpose**: Provide interactive coverage education and recommendation
- **Input Parameters**:
  - `customerProfile`: Object - Customer information
  - `riskTolerance`: String - Customer's risk preferences
  - `budget`: Number - Customer's budget constraints
- **Expected Output**:
  ```json
  {
    "educationalContent": string,
    "recommendations": object,
    "alternatives": array,
    "explanations": object
  }
  ```
- **Used By**: CustomerAgent
- **Educational**: Plain language explanations of coverage types
- **Personalization**: Tailored to customer's specific situation

## Service Integration Architecture

### Operations Agent Integration
The OperationsAgent now uses a service-oriented architecture:

```typescript
// Risk Assessment
const riskFactors = await this.riskEngine.calculateRiskFactors(customer, workflowId);
const riskMultiplier = this.riskEngine.calculateRiskMultiplier(riskFactors);
const escalationRequired = this.riskEngine.checkForEscalation(customer, riskFactors);

// Quote Generation  
const { quotes, recommendation } = await this.quoteGenerator.generateQuotes(customer, adjustedBasePremium);
```

### Service Benefits
1. **Separation of Concerns**: Business logic separated from agent coordination
2. **Maintainability**: Rating and quoting logic in dedicated services
3. **Testability**: Services can be unit tested independently
4. **Reusability**: Services can be used by multiple agents
5. **Scalability**: Services can be optimized independently

## MVP Simplifications

### Removed Complex Tools (For MVP)
- `credit_score_check` - Simplified to exclude credit-based rating
- External API integrations - Using LLM knowledge instead
- Complex regulatory compliance checks - Basic validation only

### Maintained Core Functionality
- 5-factor risk assessment using LLM knowledge
- Multi-carrier quote generation with realistic pricing
- Intelligent recommendations based on customer profiles
- Escalation for high-risk cases
- Comprehensive logging and audit trails

This architecture ensures the Clara Insurance platform demonstrates sophisticated multi-agent workflows while maintaining clean, maintainable code structure. 