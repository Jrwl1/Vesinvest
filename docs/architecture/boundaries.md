# Boundary Rules

Architecture rules should be enforced mechanically whenever possible. This document describes the intended shape; `.dependency-cruiser.cjs`, lint rules, tests, and repo-health scripts enforce it.

## Web

Preferred dependency direction:

```text
api client/types -> workflow/model/selectors -> page/controller -> UI components
```

Rules:

- API clients should not depend on page shells.
- Model, selector, workflow, parsing, and derived-state files should not depend back on page shells.
- Test support must not be imported by production files.
- User-facing strings must flow through i18n files unless the touched surface already has an accepted local exception.

## API

Preferred dependency direction:

```text
dto/types/constants -> repository/persistence -> service -> controller
```

Rules:

- Controllers should stay thin and delegate product behavior to services.
- Support/model/constants files should not depend back on services or controllers.
- Tenant-scoped data access must use server-side org context, not client-provided org ids.
- Boundary parsing and validation should happen before data crosses into core service logic.

## Shared Packages

- `packages/domain` is for shared types and domain helpers that can be reasoned about independently.
- `packages/config` owns shared tooling configuration.
- Shared packages should not import from `apps/**`.

