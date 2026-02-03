# Site Handling Contract

This document defines the rules for how sites are handled during imports and throughout the system.

## Core Principles

1. **No Implicit Defaults**: There must be no auto-created or hardcoded default site, including in demo mode.

2. **Silent Pass-Through**: An import may proceed without user interruption **only if** all detected site identifiers already exist in the organization.

3. **Mandatory Resolution for Unknown Sites**: If an import introduces one or more previously unseen site identifiers, the system must pause and ask the user to resolve them:
   - Map to existing site, OR
   - Create new site

4. **User Control**: Users must always be allowed (but never forced) to add new sites manually outside the import flow.

## Technical Implementation

### Backend

#### During Import Analysis
```typescript
// Compute unknown sites
unknownSites = detectedSiteKeys - existingOrgSites

// If unknownSites.length > 0, return blocking readiness result
if (unknownSites.length > 0) {
  return { requiresSiteResolution: true, unknownSites };
}

// Otherwise, proceed silently
return { requiresSiteResolution: false };
```

#### Site Resolution
- No fallback/default site creation logic
- No "use first site if only one exists" shortcuts
- Site must always be explicitly specified by user

### Frontend

#### Site Resolution UI
When unknown sites are detected:
1. Display: "We found assets for new location(s)."
2. For each unknown site, provide exactly two actions:
   - **Create new site**: Creates the site with the detected name
   - **Map to existing site**: Associates the unknown name with an existing site

#### No Default Site Language
- Replace any "default site" language with neutral phrasing
- Do not show site resolution step if no new site values are detected

### Demo Parity

Demo mode must follow the **exact same logic** as production:
- No demo-only shortcuts
- No seeded sites
- No bypasses

## API Endpoints

### GET /imports/:id/sheets/:sheetId/auto-extract-analysis

Returns site detection results:
```typescript
{
  // ... other fields ...
  detectedSites: string[];      // Sites found in import data
  existingSites: Site[];        // Sites in organization
  unknownSites: string[];       // Sites needing resolution
  noSitesExist: boolean;        // True if org has no sites
}
```

### POST /sites

Create a new site:
```typescript
{
  name: string;
  address?: string;
}
```

## User Experience Flow

```
Import File
    │
    ▼
Analyze Sheet
    │
    ├─── No unknown sites ──► Proceed to import
    │
    └─── Unknown sites detected
              │
              ▼
         Site Resolution UI
              │
              ├─── Create new site(s)
              │
              └─── Map to existing site(s)
                        │
                        ▼
                   Proceed to import
```

## Demo Reset

To clear old seeded sites from a demo/dev database:

### Via UI
1. Look for "Reset Demo" button in the header (only visible in demo mode)
2. Click and confirm
3. Page will reload with clean state

### Via API
```bash
curl -X POST http://localhost:3000/demo/reset
```

### Via Prisma (Development Only)
```bash
cd apps/api
pnpm prisma db push --force-reset
pnpm prisma db seed
```

## Testing

### Regression Tests

The file `apps/api/src/demo/demo-bootstrap.spec.ts` includes tests that:
1. Verify `ensureDemoOrg()` never calls `site.create` or `site.upsert`
2. Verify `ensureDemoOrg()` never calls `asset.create` or `asset.upsert`
3. Verify no hardcoded "Main Treatment Plant" or "Main Plant" site names exist

Run tests:
```bash
cd apps/api
pnpm test demo-bootstrap
```

## Migration Notes

Systems upgrading from previous versions should:
1. Remove any hardcoded "Main Plant" or similar default sites from demo bootstrapping
2. Update import services to require explicit site selection
3. Add site resolution UI to import workflow
4. Update documentation to reflect new contract
5. Run demo reset to clear old seeded data

## Rationale

This contract ensures:
- **Data Integrity**: No accidental site assignments
- **User Trust**: Users always know where assets are assigned
- **Predictability**: Imports are calm and interruption-free unless strictly necessary
- **Consistency**: Same rules in demo and production
