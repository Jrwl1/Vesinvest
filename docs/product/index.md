# Product Index

Vesipolku is a water utility financial planning product for Finnish small-to-medium water utilities. The active direction is a defendable asset-management-to-tariff workflow.

## Current Flow

1. Build a trusted historical baseline in Overview.
2. Plan asset investments and depreciation behavior.
3. Forecast financial outcomes.
4. Build a tariff package across connection fees, base fees, water usage price, and wastewater usage price.
5. Produce reports that explain whether the fee package covers future costs and investments.

## Product Sources

- Current status: `../PROJECT_STATUS.md`
- Roadmap and milestone intent: `../ROADMAP.md`
- Architecture overview: `../architecture/index.md`
- Customer-source documents: `../client/` when present and explicitly needed

## Product Invariants

- Financial decision support is the core V1 outcome.
- V1 calculations are VAT-free unless a future accepted decision changes this.
- `Yhteenveto` remains the trusted historical baseline and VEETI/manual evidence desk.
- `Ennuste` remains the forecast and scenario computation environment.
- Asset-management planning and tariff planning are the next workflow expansion areas.

