# Excel Import Guide

This guide explains how to use the Excel import system to bring asset data from spreadsheets into the system.

## Overview

The import workflow is designed for real-world water utility scenarios where:
- Spreadsheets vary in column names and structure
- The same template can be reused for similar files
- Data must comply with regulatory requirements (law-critical fields)
- Re-imports are safe and won't create duplicates

## Workflow Steps

### 1. Upload Excel File

1. Go to the **Import** tab
2. Click **Upload Excel** and select your .xlsx or .xls file
3. The system will parse all sheets and detect columns automatically

### 2. Select Target Entity

Choose what type of data you're importing:
- **Assets** - Physical assets like pipes, pumps, valves
- **Asset Types** - Categories of assets
- **Sites** - Locations where assets are installed
- **Maintenance Items** - Scheduled maintenance activities

### 3. Select or Create Mapping Template

After clicking **Start Import**, the system will:

1. **Search for matching templates** - Compares your file's columns to saved templates
2. **Show recommendations** - If a template matches >70%, it's marked as "Recommended"
3. **Let you choose** - Select an existing template or create a new mapping

#### Creating a New Mapping

If no template matches or you want a custom mapping:

1. Click **Create New Mapping**
2. For each Excel column, select the corresponding system field from the dropdown
3. The system auto-suggests mappings based on column names (supports English, Swedish, Finnish)
4. Check the **Save as reusable template** box to save for future imports

#### Using an Existing Template

Simply click on a template card to use it. The system will verify the columns still match.

### 4. Readiness Check

Before executing, the system checks your mapping completeness:

#### Field Types

| Type | Meaning | Can Use Assumption? |
|------|---------|---------------------|
| **Law-Critical** (Required) | Must be in Excel file | No - must be mapped |
| **Model-Critical** (Important) | Needed for calculations | Yes - can set default |
| **Optional** | Nice to have | N/A |

#### Summary Cards

- **Law-Critical Fields**: X / Y mapped - Shows if you can proceed
- **Model-Critical Fields**: X / Y covered - Shows completeness
- **Total Mapped**: X / Y - Overall coverage

#### Adding Assumptions

For unmapped model-critical fields, you can set default values:

1. Click **Add Assumption** next to a missing field
2. Enter the default value that applies to all rows
3. Click **Update Check** to recalculate readiness

> **Note**: Law-critical fields cannot have assumptions - they must come from the Excel file.

### 5. Configure Identity Matching

Per the **Asset Identity Contract**, all matching is by `externalRef` (business identity):

| Option | Description |
|--------|-------------|
| **Require External Reference** (default) | Import fails for rows without externalRef. Recommended for production. |
| **Allow Fallback Identity** | Auto-generates temporary IDs for rows without externalRef. Use for initial onboarding only. |

**Important**: If you allow fallback identities:
- Assets are marked as having "derived identity"
- The UI shows a warning badge on these assets
- They should be updated with real utility IDs before use in reporting

See: `docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md` for full details.

### 6. Preview Import

Click **Preview Import** to see what will happen:

- **New Records**: Assets that will be created
- **Updates**: Existing assets that will be updated
- **Skipped**: Unchanged rows (same data as before)
- **Errors**: Rows that can't be imported

### 7. Execute Import

If the preview looks good, click **Execute Import**. The import is:

- **Idempotent**: Safe to re-run - unchanged rows are skipped
- **Tracked**: Each row's source is recorded for audit
- **Resumable**: Partial imports preserve what was completed

## Template Best Practices

### Naming Templates

Use descriptive names that indicate:
- Source system: `SAP Asset Export`
- File type: `Annual Asset Inventory`
- Department: `Operations Asset List`

### Template Versioning

Templates are automatically versioned. If you need to update:
1. Create a new mapping with the same name
2. The version number increments automatically
3. Old mappings remain available for historical imports

### Multi-Language Support

Column names are matched using:
- Exact matches (case-insensitive)
- Common synonyms (e.g., "Year" ↔ "År" ↔ "Vuosi")
- Fuzzy matching for slight variations

## API Reference

### Template Matching

```bash
GET /mappings/templates/match?importId=X&sheetId=Y&targetEntity=asset
```

Returns matching templates with confidence scores.

### Readiness Check

```bash
POST /imports/:id/readiness-check
{
  "mappingId": "uuid",
  "sheetId": "uuid",
  "assumptions": [
    { "field": "status", "value": "active" }
  ]
}
```

Returns field coverage and blocking issues.

### Execute Preview

```bash
POST /imports/:id/preview
{
  "mappingId": "uuid",
  "sheetId": "uuid",
  "matchKeyStrategy": "auto"
}
```

Returns counts without making changes.

### Execute Import

```bash
POST /imports/:id/execute
{
  "mappingId": "uuid",
  "sheetId": "uuid",
  "matchKeyStrategy": "auto"
}
```

Performs the actual import.

## Troubleshooting

### "Law-critical field X is not mapped"

You must map all required fields from your Excel file. Check:
- Column name spelling
- Column is in the selected sheet
- Data exists in that column

### "No matching templates found"

Your file's columns don't match any saved templates. Options:
1. Create a new mapping manually
2. Check if column names were changed from previous files

### "Row X: Site not found"

The site value in that row doesn't match any site in the system. Options:
1. Create the site first (the system will prompt you during import)
2. Check site name spelling
3. Map the unknown site name to an existing site during import

Note: Sites must always be explicitly specified - there are no automatic defaults.

### Import shows 0 changes on re-run

This is normal! The system detects unchanged rows via hash comparison. Only modified data triggers updates.
