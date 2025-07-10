# Clara Insurance: Executive & Technical Overview

**Document Status**: Current & Aligned with CPO Directives
**Last Updated**: Aligned with "Highway" Strategy (v5)

This executive summary serves as the central "holy grail" document for the Clara Insurance project. It provides a comprehensive overview of our vision, architecture, workflow, and core principles. New team members should start here to understand the big picture, then branch out to referenced documents for deeper details.

## 1. Our Vision: The "Trusted Expert Advisor" on the Insurance "Highway"

Clara is an AI-powered insurance brokerage that combines deterministic actuarial science with intelligent, broker-like insights. Our core strategy – the "Highway Strategy" – focuses on serving the top 80% of clean, low-risk profiles while avoiding complex, high-risk cases. This allows us to deliver efficient, profitable, and trustworthy insurance experiences.

For a detailed philosophical foundation, see [manifesto.md](z_markdowns/key_documents/manifesto.md). For business strategy and investment rationale, refer to [investment_thesis_1.md](z_markdowns/key_documents/investment_thesis_1.md).

## 2. Core Philosophy: Hybrid Intelligence & 80/20 Risk Focus

- **Precision with Intelligence**: Deterministic math for calculations, AI for explanations only.
- **Efficiency with Empathy**: Collect only essential data; communicate warmly and educationally.
- **Reliability by Design**: Stateless agents, human oversight, and scalable architecture.
- **80/20 Rule**: Serve low-risk "highway" profiles; reject high-risk cases early.

All development must adhere to these principles. The math is sacred – AI never alters calculations.

## 3. System Architecture: Agentic & Hybrid

Our architecture features specialized agents powered by Gemini 2.5 Flash:

### a. Customer Agent ("Conversational Expert")
- File: `src/agents/CustomerAgent.ts`
- Role: Collects essential data, presents quotes with insights.

### b. Operations Agent ("Actuarial Intelligence")
- File: `src/agents/OperationsAgent.ts`
- Role: Performs risk assessment, generates quotes or rejections via "hard fork" logic.

### c. Deterministic Tools
- Actuarial Data: `z_actuarial_data/`
- Risk Engine: `src/tools/riskEngine.ts`
- Quote Generator: `src/tools/quoteGenerator.ts`

### d. Human-in-the-Loop
- Dashboard: `public/dashboard.html` & `dashboard.js`
- All quotes/rejections reviewed by humans.

For visual diagrams, see [clara_system_mermaid.md](z_markdowns/key_documents/clara_system_mermaid.md).

## 4. End-to-End Workflow

The process is linear and predictable:

**Phase 1: Data Collection (CustomerAgent)**
1. Customer initiates via text/voice.
2. Agent gathers essential data (name, DOB, address, vehicle, usage, violations, parking).
3. Confirm and handoff.

**Phase 2: Automated Underwriting (OperationsAgent)**
4. Risk assessment "hard fork":
   - Low-risk: Generate quotes and analysis.
   - High-risk: Create rejection summary (no quotes).
5. Send package to HITL dashboard.

**Phase 3: Human Review**
6. Expert reviews/approves/rejects via dashboard.

**Phase 4: Presentation (CustomerAgent)**
7. Present approved quote with insights or polite rejection.

## 5. Technology Stack & Implementation

- Backend: Node.js, Express, TypeScript
- AI: Gemini 2.5 Flash
- Data: In-memory for demo; Firestore for production
- Real-time: Socket.IO

For setup and running instructions, see [README.md](README.md).

## 6. Future Roadmap

- Implement full deterministic risk filter with mock APIs.
- Enhance HITL dashboard for better visualization.
- Migrate to Firestore.
- Add AI Claims Concierge.

## 7. Key References
- Manifesto: [manifesto.md](z_markdowns/key_documents/manifesto.md)
- Investment Thesis: [investment_thesis_1.md](z_markdowns/key_documents/investment_thesis_1.md)
- System Diagrams: [clara_system_mermaid.md](z_markdowns/key_documents/clara_system_mermaid.md)
- Codebase: Start with `src/server.ts` and agents/

This summary captures everything critical. For questions, consult the Chief Product Officer.

## 9. Future Outlook & Roadmap

While our current MVP demonstrates core functionality with a deterministic risk engine using actuarial tables, we're evolving toward V2 with:
- **Sophisticated Risk Assessment:** Enhanced API integrations (e.g., DASH, MVR, Moody's, FEMA) for comprehensive, rules-based evaluation.
- **Advanced Rejection Handling:** Developing robust IP around risk rejection scenarios, focusing on violations, age, location, with graceful user notifications and logging.
- **AI Integration:** Potential addition of reasoning models (e.g., Gemini or Grok) for edge cases, while maintaining deterministic core.
- **Phased Expansion:** Voice features as beta plumbing for future production; HITL dashboard (@dashboard.html/@dashboard.js) for human oversight; backend scaling (potentially off Firebase) post-funding.

This aligns with the visionary elements in [investment_thesis_1.md](z_markdowns/key_documents/investment_thesis_1.md), which provides forward-looking context for investors without binding current development to specific metrics.

## 5. Key Documents & Further Reading

- **Manifesto (`manifesto.md`):** The "why" behind our philosophy.
- **Investment Thesis (`investment_thesis_1.md`):** Our strategic plan and forward-looking vision for investors.
- **README (`README.md`):** The technical entry point for developers.

## 6. Future Roadmap: The Path to V2

Our immediate focus is on evolving our core intellectual property—the **Risk Engine**.

-   **Current State (v1.0.0 - MVP):** The current `riskEngine.ts` is a deterministic model based on pre-defined actuarial tables. It effectively assesses risk for our initial target segment and serves as a robust foundation for our MVP and initial demos.

-   **Next Evolution (v2.0):** The next iteration will transform the risk engine into a far more sophisticated and dynamic system. The goal is to build a highly accurate, deterministic risk filter that leverages external APIs for real-time data enrichment (e.g., MVR, DASH, property data). While remaining deterministic at its core to ensure predictability and trust, we will explore incorporating AI models like Gemini to handle complex edge cases and provide deeper analytical insights, without allowing the AI to make final risk-pricing decisions. This refactor is the primary objective for our next development cycle.
