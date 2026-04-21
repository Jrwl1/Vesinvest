import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SCENARIO_TYPE_CODE_TO_VALUE,
  SCENARIO_TYPE_OVERRIDE_KEY,
  SCENARIO_TYPE_VALUE_TO_CODE,
  type ScenarioType,
  type TrendPoint,
} from './v2-forecast.types';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import { DEFAULT_VESINVEST_GROUP_DEFINITIONS } from './vesinvest-contract';

export class V2ForecastScenarioMetaSupport {
  constructor(
    private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport,
  ) {}

  normalizeText(value: string | null | undefined): string | null {
    if (value == null) return null;
    let out = value;

    if (/\\u[0-9a-fA-F]{4}/.test(out)) {
      out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : '';
      });
    }

    if (out.includes('Ã') || out.includes('Æ') || out.includes('â')) {
      const recovered = Buffer.from(out, 'latin1').toString('utf8');
      if (this.looksRecoveredText(recovered, out)) {
        out = recovered;
      }
    }

    out = out.normalize('NFKC');
    out = this.stripControlCharacters(out);
    return out.trim();
  }

  looksRecoveredText(candidate: string, original: string): boolean {
    const candidateLetters = (candidate.match(/[A-Za-zÅÄÖåäö]/g) ?? [])
      .length;
    const originalLetters = (original.match(/[A-Za-zÅÄÖåäö]/g) ?? [])
      .length;
    const replacementCount = (candidate.match(/\uFFFD/g) ?? []).length;
    return (
      candidateLetters >= Math.max(3, originalLetters - 1) &&
      replacementCount === 0
    );
  }

  resolveWorkspaceYearRows(importStatus: {
    workspaceYears?: number[] | null;
    years?: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      sourceStatus?: string;
      isExcluded?: boolean;
    }>;
  }) {
    return this.planningWorkspaceSupport.resolveWorkspaceYearRows(importStatus);
  }

  isPrismaUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  resolveLatestDataIndex(points: TrendPoint[]): number {
    if (points.length === 0) return -1;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index]!;
      if (
        this.toNumber(point.revenue) !== 0 ||
        this.toNumber(point.costs) !== 0 ||
        this.toNumber(point.result) !== 0 ||
        this.toNumber(point.volume) !== 0
      ) {
        return index;
      }
    }
    return points.length - 1;
  }

  resolveLatestComparableYear(
    years:
      | Array<{
          vuosi: number;
          completeness?: {
            tilinpaatos?: boolean;
            volume_vesi?: boolean;
            volume_jatevesi?: boolean;
          };
        }>
      | undefined,
  ): number | null {
    if (!Array.isArray(years) || years.length === 0) return null;
    let latestComplete: number | null = null;
    let latestWithTilinpaatos: number | null = null;
    for (const row of years) {
      const year = Number(row?.vuosi);
      if (!Number.isFinite(year)) continue;
      const hasTilinpaatos = row?.completeness?.tilinpaatos === true;
      const hasVolume =
        row?.completeness?.volume_vesi === true ||
        row?.completeness?.volume_jatevesi === true;

      if (
        hasTilinpaatos &&
        (latestWithTilinpaatos == null || year > latestWithTilinpaatos)
      ) {
        latestWithTilinpaatos = year;
      }
      if (
        hasTilinpaatos &&
        hasVolume &&
        (latestComplete == null || year > latestComplete)
      ) {
        latestComplete = year;
      }
    }
    return latestComplete ?? latestWithTilinpaatos;
  }

  formatIsoDate(value: Date | string): string {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value instanceof Date ? parsed.toISOString().slice(0, 10) : value;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  buildDefaultScenarioName(value: Date | string): string {
    return `Scenario ${this.formatIsoDate(value)}`;
  }

  resolveAuthoritativeDepreciationClassName(
    assetClassKey: string | null | undefined,
    fallbackName: string | null | undefined,
  ): string | null {
    const normalizedKey = String(assetClassKey ?? '').trim();
    if (normalizedKey.length > 0) {
      const authoritativeLabel =
        DEFAULT_VESINVEST_GROUP_DEFINITIONS.find(
          (group) => group.key === normalizedKey,
        )?.label ?? null;
      if (authoritativeLabel) {
        return authoritativeLabel;
      }
    }
    const normalizedFallback = this.normalizeText(fallbackName ?? null);
    return normalizedFallback && normalizedFallback.length > 0
      ? normalizedFallback
      : null;
  }

  normalizeScenarioType(raw: unknown): ScenarioType {
    if (
      raw === 'base' ||
      raw === 'committed' ||
      raw === 'hypothesis' ||
      raw === 'stress'
    ) {
      return raw;
    }
    return 'hypothesis';
  }

  resolveScenarioType(rawOverrides: unknown, onOletus: boolean): ScenarioType {
    if (onOletus) {
      return 'base';
    }
    if (!rawOverrides || typeof rawOverrides !== 'object') {
      return 'hypothesis';
    }
    const rawCode = Number(
      (rawOverrides as Record<string, unknown>)[SCENARIO_TYPE_OVERRIDE_KEY],
    );
    return SCENARIO_TYPE_CODE_TO_VALUE[rawCode] ?? 'hypothesis';
  }

  resolveScenarioTypeForCreate(params: {
    requestedScenarioType?: ScenarioType;
    existingBaseScenarioExists: boolean;
    sourceScenarioType: ScenarioType | null;
  }): ScenarioType {
    const {
      requestedScenarioType,
      existingBaseScenarioExists,
      sourceScenarioType,
    } = params;
    const normalizedRequested =
      requestedScenarioType == null
        ? null
        : this.normalizeScenarioType(requestedScenarioType);
    if (normalizedRequested === 'base') {
      if (existingBaseScenarioExists) {
        throw new BadRequestException('Base scenario already exists.');
      }
      return 'base';
    }
    if (normalizedRequested) {
      return normalizedRequested;
    }
    if (!existingBaseScenarioExists) {
      return 'base';
    }
    if (sourceScenarioType && sourceScenarioType !== 'base') {
      return sourceScenarioType;
    }
    return 'hypothesis';
  }

  withScenarioTypeOverride(
    overrides: Record<string, number> | undefined,
    scenarioType: ScenarioType,
  ): Record<string, number> {
    const next = { ...(overrides ?? {}) };
    if (scenarioType === 'base') {
      delete next[SCENARIO_TYPE_OVERRIDE_KEY];
      return next;
    }
    next[SCENARIO_TYPE_OVERRIDE_KEY] =
      SCENARIO_TYPE_VALUE_TO_CODE[scenarioType];
    return next;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private stripControlCharacters(value: string): string {
    return Array.from(value)
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 0x20 && codePoint !== 0x7f;
      })
      .join('');
  }
}
