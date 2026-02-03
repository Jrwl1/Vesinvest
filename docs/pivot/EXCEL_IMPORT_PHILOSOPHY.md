# Excel Import Philosophy – Plan20 Water Utilities Pivot

Version: 0.1  
Status: Foundational design document  
Scope: How Plan20 ingests, interprets, and operationalizes Excel data from water utilities

---

## 1. First Principles

### Excel Is Not the Problem  
Excel is the **system of record** for small and medium-sized water utilities.

The problem is not Excel itself, but that:
- Data is implicit instead of explicit
- Logic is embedded in formulas
- Structures differ slightly between organizations
- Critical assumptions are undocumented

Plan20 is designed to **respect Excel as the source of truth**, not replace it.

---

## 2. Reality Check: How Excel Is Used Today

Across utilities:
- Asset registers live in Excel
- Pipe networks are tracked as rows and totals
- Lifetimes are assumed, not written
- Costs are adjusted manually
- Investment planning is done via copied spreadsheets
- Tariff calculations rely on fragile formulas

No two Excel files are identical — but **they rhyme**.

Plan20 assumes:
- Similar intent
- Different structure
- Varying levels of completeness

---

## 3. Design Goal

> Any reasonably structured Excel file should be importable **without manual re-entry**, even if it is incomplete.

This requires:
- Flexibility in intake
- Explicit handling of missing data
- A clear separation between **data**, **assumptions**, and **logic**

---

## 4. The Three-Layer Import Model

### 4.1 Layer 1: Raw Excel Intake

What Plan20 accepts:
- Multiple Excel files
- Multiple sheets per file
- Arbitrary column names
- Mixed languages (Swedish / Finnish / English)

What Plan20 does NOT assume:
- Fixed templates
- Required column order
- Exact naming conventions

At this layer:
- Nothing is rejected
- Nothing is normalized
- Nothing is “wrong”

This is **pure ingestion**.

---

### 4.2 Layer 2: Intermediate Mapping Layer (Critical)

This is the **core innovation**.

The mapping layer:
- Translates user Excel columns → Plan20 canonical fields
- Can be edited visually
- Can be exported/imported as Excel itself
- Can be reused across similar utilities

Key properties:
- One mapping per organization (or per dataset)
- Versioned
- Explicit

Example (conceptual):
- Excel column “Byggår” → Canonical field “installation_year”
- Excel column “Längd (m)” → Canonical field “length_meters”

If data is missing:
- The system flags it
- Explains why it matters
- Asks for it once

---

### 4.3 Layer 3: Canonical Internal Model

Once mapped, all data lives in a **clean, normalized internal schema**.

This model is:
- Independent of Excel
- Stable over time
- Aligned with regulation
- Used by projections, simulations, and reporting

Excel never directly feeds calculations — only the canonical model does.

---

## 5. Handling Missing or Ambiguous Data

Missing data is **expected**, not exceptional.

Plan20 distinguishes between:

### 5.1 Law-Critical Missing Data
Must be provided before compliance outputs are possible.
Example:
- Asset lifetime
- Replacement cost logic
- Planning horizon

### 5.2 Model-Critical Missing Data
Required for projections, but can be filled with defaults.
Example:
- Inflation assumption
- Renewal strategy

### 5.3 Optional Enrichment Data
Improves accuracy but is not required.
Example:
- Condition class
- Failure history

The app:
- Explains *why* something is needed
- Never silently assumes without disclosure

---

## 6. Excel as a First-Class Citizen

Excel remains part of the workflow:

- Mapping definitions can be exported as Excel
- Users can fill missing values in Excel
- Revised Excel files can be re-imported
- Round-tripping is supported

Plan20 does not “lock” users away from Excel.

---

## 7. No Forced Templates (Initially)

Plan20 does **not** require:
- A specific Excel template
- A specific column layout

Instead:
- Templates may be offered later as optional helpers
- Never as a hard requirement

Adoption > purity.

---

## 8. Auditability & Trust

For every number in a projection:
- The originating Excel column is traceable
- The mapping decision is visible
- The assumption is documented

This is essential for:
- Board discussions
- Regulator scrutiny
- Knowledge transfer when staff changes

---

## 9. What This Philosophy Explicitly Avoids

Plan20 will not:
- Auto-guess silently
- Hide assumptions
- Break if Excel is “messy”
- Force users to rebuild history

---

## 10. Strategic Implication

The Excel import layer is **not a feature**.
It is the **product moat**.

Anyone can build projections.
Few can safely translate 30 years of Excel entropy into regulatory truth.

---

## 11. Design Constraint Going Forward

Any new feature must answer:
> How does this interact with imported Excel data?

If the answer is unclear, the feature is premature.

---

End of document.
