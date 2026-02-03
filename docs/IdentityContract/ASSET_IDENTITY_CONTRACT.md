# Asset Identity Contract

## Purpose

This document defines how assets are uniquely identified, tracked, and preserved over time in the system.

The goal is to ensure:
- Idempotent Excel imports
- Reliable long-term investment planning (20+ years)
- Auditability and legal defensibility
- Stable frontend behavior across re-imports and scenario changes

This contract is authoritative.  
All import, mapping, projection, and reporting logic must conform to it.

---

## Core Principle

**An asset’s identity must be stable across time, imports, and scenarios.**

Identity is **not**:
- A database primary key
- A row number in Excel
- A mutable display name

Identity **is**:
- A utility-recognized internal identifier that survives operational use

---

## Canonical Asset Identifier

### Primary Identifier

Each asset MUST have exactly one canonical identifier:

**`externalRef` (string, required)**

This represents the **utility-internal asset ID**, such as:
- GIS system ID
- Internal asset register number
- Maintenance system identifier

Characteristics:
- Stable over time
- Unique within the organization
- Human-recognizable by the utility
- Imported from Excel or explicitly provided

This identifier is:
- Required for all law-critical assets
- Immutable once the asset is created
- Used for idempotent imports and updates

---

## Fallback Identifier (Controlled)

If no explicit internal ID exists, a deterministic fallback MAY be used.

### Definition

fallbackExternalRef = hash(
assetType +
siteId +
normalizedName
)


### Rules

- Must be explicitly acknowledged during import
- Marked as **derived identity**
- Eligible for later replacement with a real internal ID
- Never silently generated

Fallbacks exist to enable onboarding — **not** as a long-term solution.

---

## Identity vs Database Keys

- Database `id` is an implementation detail
- `externalRef` is the **business identity**
- All matching, updates, and projections key off `externalRef`

No feature may rely on database IDs for cross-import logic.

---

## Identity Lifecycle Rules

### Creation
- Asset is created when an `externalRef` is first encountered
- Source provenance is recorded (import, sheet, row)

### Update
- Re-import with the same `externalRef` updates the asset
- Changes are revisions, not new assets

### Replacement
- Replacing an asset creates a **new identity**
- Old asset is marked as `decommissioned`
- Replacement relationship may be recorded later

### Decommissioning
- Asset remains in the system for historical and planning purposes
- Excluded from future operational views
- Included in historical projections

Deletion is not allowed for assets used in projections.

---

## Identity and Planning Scenarios

- Identity is global per organization
- Planning scenarios reference assets by identity
- Changing a scenario must never change asset identity
- Projections may diverge; identity must not

---

## Identity and Excel Imports

During import:
- `externalRef` mapping is mandatory for law-critical assets
- Import execution matches on `externalRef`
- Row hashes detect content changes, not identity

If `externalRef` is missing:
- Import is blocked OR
- User must explicitly choose the fallback strategy

---

## Provenance Requirements

For every asset, the system must be able to answer:
- Where did this asset come from?
- When was it last updated?
- From which Excel file, sheet, and row?
- Was this value imported or assumed?

Provenance is a first-class concern.

---

## Legal Alignment (Finland)

This contract aligns with:
- Long-term investment planning requirements
- Asset traceability expectations
- Municipal audit practices
- Future VEETI / SYKE reporting

External reporting identifiers (VEETI, SYKE) are treated as **attributes**, not identities.

---

## Explicit Non-Goals

This contract does NOT require:
- Mandatory national registry IDs at import
- Automatic reconciliation with external registries
- Cross-utility global asset identity

These can be layered later without breaking this contract.

---

## Consequences

By adopting this contract:
- Excel becomes a transport format, not a system of record
- Imports are safe to repeat
- UI can display confidence and lifecycle
- Legal compliance becomes incremental

Breaking this contract will cause:
- Duplicate assets
- Invalid projections
- Audit risk
- Frontend inconsistency

---

## Status

This contract is **binding** as of first production demo.

Changes require an explicit migration strategy.
