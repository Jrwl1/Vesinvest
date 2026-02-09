> ⚠️ **DEPRECATED / HISTORICAL**  
> Do not use as current spec. Canonical docs: [docs/CANONICAL.md](../CANONICAL.md). For current architecture use: [ARCHITECTURE.md](../ARCHITECTURE.md), [API.md](../API.md).

---

# PIVOT: Plan20 → Water Utilities Asset Management, Investment Planning & Tariff Support

Version: 0.1  
Status: Strategic pivot definition  
Audience: Founder, domain experts, future partners, regulators, developers

---

## 1. Executive Summary

Plan20 is pivoting from a generic asset management tool into a **regulation-aligned planning system for small and medium-sized water utilities**.

The core problem is not lack of data — it is that **critical infrastructure data exists almost exclusively in Excel**, in hundreds of slightly different formats, built up over decades.

The upcoming Finnish water legislation requires utilities to:
- Maintain a long-term asset register
- Demonstrate renewal planning (20+ years)
- Justify investment needs
- Show how tariffs support financial sustainability

Plan20 becomes the **translation layer** between:
- Legacy Excel reality  
and  
- Regulatory, financial, and planning requirements

---

## 2. The Reality of Water Utilities

### 2.1 How Utilities Actually Work Today

Small water utilities typically:
- Use Excel as their primary system of record
- Maintain asset lists, pipe lengths, costs, and ages manually
- Run tariff simulations with hidden formulas
- Depend on tacit knowledge held by 1–2 key individuals

They will **not**:
- Re-enter data manually into a new system
- Abandon Excel overnight
- Trust black-box calculations

---

## 3. Regulatory Context (Finland)

The new water legislation (incoming) increases requirements around:

- Long-term asset management
- Documented renewal strategies
- Financial sustainability
- Transparent tariff-setting logic
- Auditability of assumptions

This creates a **mandatory need** for:
- Structured asset registers
- 20–40 year investment planning
- Explicit assumptions (lifetimes, costs, inflation, risk)
- Repeatable, explainable outputs

Plan20 is positioned as a **compliance enabler**, not just a planning tool.

---

## 4. Core Pivot Principle

### Excel Is the Source — Plan20 Is the Interpreter

All utilities have **similar but not identical** Excel files.

Therefore:
- The app must adapt to Excel
- Not the other way around

Plan20 must:
- Import heterogeneous Excel files
- Extract usable data
- Identify missing critical inputs
- Ask targeted clarification questions
- Allow intermediate Excel-based mappings

---

## 5. Canonical Internal Model vs Reality

### 5.1 Canonical Model (Internal Truth)

This is the **minimum model required** to:
- Comply with regulation
- Run credible projections
- Support tariff calculations

### 5.2 Intermediate Layer (Critical Concept)

Between Excel → Canonical Model sits an **Intermediate Mapping Layer**.

This layer:
- Maps customer-specific Excel columns to canonical fields
- Can be edited in UI
- Can be imported/exported as Excel
- Can be reused between similar utilities

This avoids forcing a single Excel format.

---

## 6. Law-Critical Assumptions (Non-Negotiable)

If any of the following are missing, the system must **explicitly ask for them**.

### 6.1 Asset-Level Requirements

Minimum per asset or asset group:
- Asset category (pipe, pump, treatment, reservoir, etc.)
- Installation year or age
- Expected technical lifetime
- Replacement cost (current or normalized)
- Criticality / consequence of failure

### 6.2 Network-Level Requirements

- Total network length by category
- Renewal strategy (linear, clustered, risk-based)
- Annual renewal capacity (km/year or €/year)

### 6.3 Financial Assumptions

- Planning horizon (minimum 20 years)
- Inflation assumption
- Discount rate or regulatory default
- Current tariff level
- Revenue baseline

### 6.4 Required Outputs

- Annual investment needs
- Cumulative renewal backlog
- Tariff adjustment trajectory
- Scenario comparisons (“what if we delay?”)

---

## 7. Existing Excel Sheets — Do They Contain This?

**Yes — but implicitly.**

Typical patterns:
- Assets, years, lengths, and costs exist
- Lifetimes are assumed, not explicit
- Risk is embedded in experience, not data
- Financial logic lives in formulas, not structure

Plan20’s role:
- Make assumptions explicit
- Separate data from logic
- Centralize and version assumptions
- Produce defensible outputs

---

## 8. Product Structure After Pivot

### 8.1 Excel Intake

- Upload Excel files
- Select relevant sheets
- Preview detected columns
- Auto-suggest mappings (e.g. “installation year”)

### 8.2 Mapping / Intermediate Layer

- Confirm mappings
- Flag missing required inputs
- Fill gaps via:
  - Defaults
  - One-time inputs
  - Additional Excel uploads

### 8.3 Canonical Asset Register

- Clean, normalized internal data
- Versioned
- Auditable

### 8.4 Planning & Projection Engine

- 20–40 year horizon
- Renewal waves
- Cost curves
- Capacity constraints

### 8.5 Tariff Simulation

- Required tariff path
- Deferred investment consequences
- Sensitivity to inflation and assumptions

### 8.6 Compliance Outputs

- Tables
- Graphs
- Excel / PDF exports
- Regulator- and board-ready

---

## 9. Nice-to-Haves (Carefully Limited)

### 9.1 Assumption Profiles
- Conservative
- Regulatory minimum
- Optimistic

Makes assumptions transparent and debatable.

### 9.2 Peer Benchmarks (Later Phase)
- Anonymous comparison:
  - €/km
  - Renewal rate
  - Asset age distribution

### 9.3 Scenario Locking
- Freeze approved plans
- Compare planned vs actual over time

---

## 10. Strategic Reframing

Plan20 is **not**:
- A generic asset tool
- A maintenance CMMS
- A BIM system

Plan20 **is**:
> A translation layer between legacy Excel infrastructure data and regulatory truth.

This is a narrow, painful, high-value niche.

---

## 11. Immediate Next Step (Non-Code)

Before further implementation:

1. Freeze the **Canonical Water Utility Asset Schema**
2. Label each field as:
   - Legally required
   - Projection-critical
   - Optional enrichment
3. Compare schema against real Excel files column-by-column

Everything else flows from this.

---

End of document.
