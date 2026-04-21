import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { V2ForecastService } from './v2-forecast.service';
import type { ScenarioPayload } from './v2-report.types';
import { V2ReportBaselineSupport } from './v2-report-baseline-support';

export class V2ReportCreationSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: V2ForecastService,
    private readonly baselineSupport: V2ReportBaselineSupport,
  ) {}

  async buildVesinvestAppendix(
    projects: Array<{
      groupKey: string;
      accountKey: string | null;
      projectCode: string;
      projectName: string;
      totalAmount: Prisma.Decimal | number | null;
      allocations: Array<{
        year: number;
        totalAmount: Prisma.Decimal | number;
        waterAmount?: Prisma.Decimal | number | null;
        wastewaterAmount?: Prisma.Decimal | number | null;
      }>;
    }>,
    scenarioYears: number[],
    orgId: string,
  ) {
    const yearSet = new Set<number>();
    for (const year of scenarioYears) {
      yearSet.add(year);
    }
    for (const project of projects) {
      for (const allocation of project.allocations) {
        yearSet.add(allocation.year);
      }
    }

    const years = [...yearSet].sort((left, right) => left - right);
    const groupDefinitions = await this.baselineSupport.getOrderedVesinvestGroupDefinitions(orgId);
    const groupDefinitionByKey = new Map(
      groupDefinitions.map((group, index) => [group.key, { ...group, index }] as const),
    );
    const depreciationRules = await this.forecastService.listDepreciationRules(orgId);
    const depreciationRuleByClassKey = new Map(
      depreciationRules.map((rule) => [rule.assetClassKey, rule] as const),
    );
    const groupMap = new Map<
      string,
      {
        classKey: string;
        classLabel: string;
        totalAmount: number;
        projects: Array<{
          code: string;
          name: string;
          classKey: string;
          classLabel: string;
          accountKey: string | null;
          allocations: Array<{
            year: number;
            totalAmount: number;
            waterAmount: number | null;
            wastewaterAmount: number | null;
          }>;
          totalAmount: number;
        }>;
      }
    >();
    const yearlyTotalsMap = new Map<number, number>();

    for (const project of projects) {
      const projectGroupKey = project.groupKey;
      const groupDefinition = groupDefinitionByKey.get(projectGroupKey);
      const classLabel = groupDefinition?.label ?? projectGroupKey;
      const totalAmount = this.baselineSupport.round2(this.baselineSupport.toNumber(project.totalAmount));
      const currentGroup = groupMap.get(projectGroupKey) ?? {
        classKey: projectGroupKey,
        classLabel,
        totalAmount: 0,
        projects: [],
      };
      currentGroup.totalAmount = this.baselineSupport.round2(currentGroup.totalAmount + totalAmount);
      currentGroup.projects.push({
        code: project.projectCode,
        name: project.projectName,
        classKey: projectGroupKey,
        classLabel,
        accountKey:
          project.accountKey ??
          groupDefinition?.defaultAccountKey ??
          null,
        allocations: project.allocations.map((allocation) => ({
          year: allocation.year,
          totalAmount: this.baselineSupport.round2(this.baselineSupport.toNumber(allocation.totalAmount)),
          waterAmount:
            allocation.waterAmount == null
              ? null
              : this.baselineSupport.round2(this.baselineSupport.toNumber(allocation.waterAmount)),
          wastewaterAmount:
            allocation.wastewaterAmount == null
              ? null
              : this.baselineSupport.round2(this.baselineSupport.toNumber(allocation.wastewaterAmount)),
        })),
        totalAmount,
      });
      groupMap.set(projectGroupKey, currentGroup);

      for (const allocation of project.allocations) {
        yearlyTotalsMap.set(
          allocation.year,
          this.baselineSupport.round2(
            (yearlyTotalsMap.get(allocation.year) ?? 0) +
              this.baselineSupport.toNumber(allocation.totalAmount),
          ),
        );
      }
    }

    const yearlyTotals = years.map((year) => ({
      year,
      totalAmount: this.baselineSupport.round2(yearlyTotalsMap.get(year) ?? 0),
    }));

    const fiveYearBands: Array<{
      startYear: number;
      endYear: number;
      totalAmount: number;
    }> = [];
    for (let index = 0; index < yearlyTotals.length; index += 5) {
      const slice = yearlyTotals.slice(index, index + 5);
      if (slice.length === 0) {
        continue;
      }
      fiveYearBands.push({
        startYear: slice[0]!.year,
        endYear: slice[slice.length - 1]!.year,
        totalAmount: this.baselineSupport.round2(
          slice.reduce((sum, item) => sum + item.totalAmount, 0),
        ),
      });
    }

    const groupedProjects = [...groupMap.values()]
      .sort((left, right) => {
        const leftOrder =
          groupDefinitionByKey.get(left.classKey)?.index ?? Number.MAX_SAFE_INTEGER;
        const rightOrder =
          groupDefinitionByKey.get(right.classKey)?.index ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.classLabel.localeCompare(right.classLabel);
      })
      .map((group) => ({
        ...group,
        projects: [...group.projects].sort((left, right) =>
          left.code.localeCompare(right.code),
        ),
      }));
    const depreciationPlan = groupDefinitions.map((group) => {
      const rule = depreciationRuleByClassKey.get(group.key);
      return {
        classKey: group.key,
        classLabel: group.label,
        accountKey: group.defaultAccountKey ?? null,
        serviceSplit: group.serviceSplit,
        method: rule?.method ?? 'none',
        linearYears: rule?.linearYears ?? null,
        residualPercent: rule?.residualPercent ?? null,
      };
    });

    return {
      yearlyTotals,
      fiveYearBands,
      groupedProjects,
      depreciationPlan,
    };
  }

  investmentSeriesMatchesYearlyInvestments(
    scenario: ScenarioPayload,
  ): boolean {
    const computedByYear = new Map<number, number>();
    for (const row of scenario.investmentSeries) {
      computedByYear.set(
        row.year,
        this.baselineSupport.round2((computedByYear.get(row.year) ?? 0) + this.baselineSupport.toNumber(row.amount)),
      );
    }

    const inputByYear = new Map<number, number>();
    for (const row of scenario.yearlyInvestments) {
      inputByYear.set(
        row.year,
        this.baselineSupport.round2((inputByYear.get(row.year) ?? 0) + this.baselineSupport.toNumber(row.amount)),
      );
    }

    const years = new Set<number>([
      ...computedByYear.keys(),
      ...inputByYear.keys(),
    ]);

    for (const year of years) {
      const computed = computedByYear.get(year) ?? 0;
      const amount = inputByYear.get(year) ?? 0;
      if (Math.abs(computed - amount) > 0.01) {
        return false;
      }
    }

    return true;
  }

}
