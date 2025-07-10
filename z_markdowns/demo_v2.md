# Product Brief: Clara Demo V2

**Authored By:** Office of the Chief Product Officer
**Status:** Approved
**Subject:** From a Functional MVP to a Strategically-Aligned V2 Demo

---

### 1. CPO Directive: The "Why"

Our first demo successfully proved that our agentic system can execute a basic quote workflow. Its purpose was to establish functional viability.

The purpose of **Demo V2 is to prove our strategic viability.** We must now build the features that make our "Highway Strategy" tangible. This next phase is not about adding more features for the sake of it; it is a surgical effort to build out the core intellectual property and user experiences that define our competitive advantage. When stakeholders see this next demo, they must walk away with a crystal-clear understanding of how we use a deterministic core and human oversight to curate a profitable book of business.

We will focus our engineering efforts on two pillars: **implementing our proprietary Risk Filter** and **enhancing our HITL Dashboard** to visualize the output of that filter. This is the highest-leverage work we can do to de-risk our technical approach and showcase the power of our model.

---

### 2. The Engineering Mandate for V2

Our goal is to evolve the demo from a simple workflow to a compelling, interactive representation of our core strategy.

#### **Pillar 1: Implement the `Deterministic Risk Filter`**

This is our secret sauce, and it's time to build it. The `OperationsAgent` must evolve from a simple risk assessor into a sophisticated gatekeeper.

*   **Action Item:** Create a new `DeterministicRiskFilter` service within the `src/tools/` directory.
*   **Technical Directive:**
    *   This service will contain the hard-coded filtering logic that defines our "80/20" rule.
    *   For V2, we will **not** integrate with live, paid APIs. Instead, the engineering team will create **mock API services** that simulate calls to external data providers (e.g., a `mockFemaApi.ts` that can flag addresses in a predefined "flood zone," a `mockMvrApi.ts` that can return specific violation histories for our test personas).
    *   The `OperationsAgent` must be refactored to use this new `DeterministicRiskFilter` service at the start of its process. This is the "hard fork."
    *   The output of the filter must be a clear, concise reason for any rejection (e.g., `{ pass: false, reason: "2+ at-fault accidents", source: "MVR API" }`). This structured output is critical for Pillar 2.

#### **Pillar 2: Enhance the `HITL Dashboard`**

The dashboard is the window into our strategy. It must evolve to explicitly show our hybrid intelligence model in action.

*   **Action Item:** Refactor the existing `dashboard.html` to be a more dynamic, multi-pane interface that can visualize the entire workflow.
*   **Technical Directive:**
    *   The dashboard should display a queue of applications for review.
    *   When a reviewer selects an application, they must see the full data package.
    *   Crucially, for a **rejected** application, the dashboard must clearly display the structured reason from the `DeterministicRiskFilter`. For example: `REJECTION REASON: 2+ at-fault accidents (Source: MVR API)`.
    *   This makes the `Human-in-the-Loop` principle tangible. The human expert isn't just reviewing a quote; they are validating the output of our automated risk filter, ensuring the system is correctly enforcing our risk appetite.

#### **Pillar 3: Refine `CustomerAgent` Communication**

With a more robust rejection path, we must ensure the final step of the customer journey is handled with the empathy and clarity our brand promises.

*   **Action Item:** Update the `CustomerAgent` to handle the final, human-approved rejection status.
*   **Technical Directive:**
    *   When the human expert confirms a rejection on the HITL dashboard, the `CustomerAgent` must be re-engaged with this final status.
    *   The agent must then deliver a polite, empathetic, and helpful message to the user, guiding them on potential next steps without revealing the specific, sensitive underwriting rule that was triggered. This logic must be explicitly built out.

---

### 3. Out of Scope for Demo V2

To maintain surgical focus, the following items are explicitly **out of scope** for this phase:

*   **Full Firestore Integration:** We will continue to use and enhance our `MemoryDataStore`. This allows us to perfect the application logic before committing to a persistent architecture.
*   **AI Claims Concierge:** While a critical part of our long-term strategy, the claims workflow is a separate and significant undertaking. We will tackle it after perfecting the core customer acquisition and underwriting journey.
*   **New Actuarial Data:** We will continue to use the existing, audited data in `z_actuarial_data/`.

---

### 4. CPO Closing Statement

Executing this V2 plan will provide us with a powerful asset. It will be a deeper, more compelling demonstration that proves we have a well-defined, executable strategy for disrupting the insurance market. This is how we build confidence and accelerate our path forward. Let's get to it. 