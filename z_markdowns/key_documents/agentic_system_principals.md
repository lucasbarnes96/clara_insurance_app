1. Audit Agent Outputs: Enforce Structured (JSON) Tool Calls
Step:
Require all agent outputs to be structured, machine-readable JSON—not plain text.

Example:
Bad:

"Send an email to Alice confirming the meeting."

Good:

json
{
  "action": "send_email",
  "recipient": "alice@example.com",
  "subject": "Meeting Confirmation",
  "body": "Hi Alice, confirming our meeting."
}

2. Rigorously Manage the Context Window
Step:
Be explicit and cautious about every token used. Limit context to only what’s necessary.

Example:

Trim irrelevant history: Only include the last customer message, not the entire chat log.

Summarize prior steps:
Instead of:

"First, you asked about X, then Y, then Z..."

Use:

"Summary: User requested X, Y, Z."

Monitor token usage:
Set alerts if context window usage exceeds 80% capacity.

3. Standardize Tool Calls as JSON Schemas
Step:
Define all tool outputs and inputs as JSON schemas. Validate every agent response against the schema.

Example:

json
{
  "type": "object",
  "properties": {
    "action": {"type": "string"},
    "parameters": {"type": "object"}
  },
  "required": ["action", "parameters"]
}
Enforce schema validation before executing any tool call.

4. Unify Execution State and Business State
Step:
Ensure the agent’s understanding (its “state”) matches real business data.

Example:

Before confirming an order, the agent fetches the latest order status from the database, not just its memory.

**CPO Clarification on State Management in Demo vs. Production:**

The "business state" is the single source of truth. In a production environment, this is unequivocally a persistent database (e.g., Google Firestore). All agent actions must read from and write to this database to ensure system-wide consistency.

For our current **demo environment**, the "business state" is our **in-memory data store (`MemoryDataStore`)**. While not persistent, it serves as the authoritative source of truth *during a single session*. The principle remains the same: an agent's internal state must not diverge from the central in-memory store. An agent should receive data from the store, process it, and write the complete result back. This practice builds the architectural muscles required for the inevitable migration to a persistent database like Firestore, ensuring our logic remains sound and scalable.

5. Compact Errors and Feedback into Context
Step:
Summarize errors or feedback in a concise format for the agent’s next step.

Example:
Bad:

"The payment failed because the user’s credit card was declined due to insufficient funds. Please try again with another card."

Good:

json
{
  "error": "payment_failed",
  "reason": "insufficient_funds"
}
6. Build Small, Focused Agents
Step:
Divide complex tasks into specialized, single-purpose agents.

Example:

One agent handles scheduling.

Another agent handles email composition.

Each agent receives only the context it needs.

7. Make Agents Stateless Reducers
Step:
Design agents to process input and produce output without storing internal state.

Example:

Agent receives full context as input, returns a single JSON response.

All persistent data is stored in external databases, not in the agent’s memory.

8. Monitor and Limit Token Usage
Step:
Set strict limits on tokens in and out. Log and review token consumption.

Example:

Reject requests that would exceed the model’s context window.

Log every input/output token count for cost and performance tracking.

9. Review and Iterate
Step:
Regularly review agent logs, prompts, and outputs for adherence to these principles.

Example:

Weekly audits of agent JSON outputs for schema compliance.

Automated tests to ensure context window limits are respected.

Summary Table: Critical Steps for Simplicity and Reliability

Step	Focus Area	Example Action
Structured JSON outputs	Tool Calls	Validate all outputs against JSON schema
Prompt versioning	Prompts	Store in Git, review as code
Token/context window management	Context Window	Trim/summarize context, set token alerts
Stateless agent design	Simplicity	No internal state, all context in input
Error compaction	Error Handling	Summarize errors as JSON, not verbose text
Key Principle:
Simplicity, explicit structure, and rigorous control of context and tokens are non-negotiable for robust, scalable agentic systems.

