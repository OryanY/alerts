# 🤖 Business Logic: Incident Management

The **Incident Management Subsystem** is the core automation engine of the platform. Its purpose is to ingest raw alerts, evaluate them against a set of business rules, and automatically manage the lifecycle of incidents in ServiceNow.

## The Rule Engine

The heart of the automation is the `IncidentRuleEngine` service. It uses a **specificity-based matching algorithm** to determine how an alert should be handled.

### Matching Algorithm
When an alert fires, the engine evaluates all *enabled* rules. Use the following hierarchy to determine which rule "wins":

1.  **Global vs. Specific**: Specific rules (tied to a specific System Mapping) always take precedence over Global rules.
2.  **Specificity Score**: Within the same tier, rules are scored based on their conditions:
    *   **Exact Match** (e.g., `Node Name == 'Server1'`): **10 points**
    *   **Regex Match** (e.g., `Message matches /CPU/`): **7 points**
    *   **Contains Match** (e.g., `Object contains 'Db'`): **3 points**

The rule with the **highest score** applies. This allows operators to define broad "catch-all" rules while creating precise exceptions for specific critical assets.

### Logic Operators
Rules support complex boolean logic:
*   **AND**: All defined conditions must be met.
*   **OR**: At least one condition must be met.

---

## Automated Incident Lifecycle

The `IncidentService.createIncidentFromAlert` method manages the external side-effects with ServiceNow. This is a non-trivial process involving deduplication and state management.

### The Flow
1.  **Ingest**: Receive alert data.
2.  **Rule Match**: Find the best matching rule (as described above).
3.  **Deduplication**: Query the database for an *existing, active* incident for this specific Node/Application pair.
    *   **Scenario A (Active Incident Exists)**: Do not spam ServiceNow. Instead, update the existing ticket with a work-note ("Alert re-fired").
    *   **Scenario B (No Active Incident)**: Proceed to creation.
4.  **Creation**:
    *   Resolve **System Mapping**: Identify the `Business Service` and `Assignment Group`.
    *   Apply **Overrides**: If the Rule specifies a unique description or severity, apply it.
    *   **API Call**: Send POST request to ServiceNow.
5.  **Persist**: Save the new Incident ID and state to the mongo database to track its lifecycle.

## System Mappings
System Mappings bridge the gap between Grafana and ServiceNow.

Each mapping connects a **Technical Identifier** (e.g., a regex matching `application`) to **Business Context** (e.g., "Payment Gateway" service, "FinTech-Support" group).

> **Architectural Note:** Mappings are decoupled from Rules. Multiple Rules can rely on the same Mapping, allowing you to change assignment groups in one place without editing 50 individual rules.
