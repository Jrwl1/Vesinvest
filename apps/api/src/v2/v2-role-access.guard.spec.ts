import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { V2Controller } from './v2.controller';
import { V2AdminGuard, V2EditorGuard } from './v2-role-access.guard';

function mockContext(roles?: string[]): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: roles ? { roles } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

function methodGuards(methodName: keyof V2Controller): Function[] {
  return (
    Reflect.getMetadata(GUARDS_METADATA, V2Controller.prototype[methodName]) ??
    []
  );
}

describe('V2 role access guards', () => {
  it('allows admins through admin-only V2 routes', () => {
    expect(new V2AdminGuard().canActivate(mockContext(['ADMIN']))).toBe(true);
    expect(new V2AdminGuard().canActivate(mockContext(['admin']))).toBe(true);
  });

  it('blocks users and viewers from admin-only V2 routes', () => {
    const guard = new V2AdminGuard();
    expect(() => guard.canActivate(mockContext(['USER']))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(mockContext(['VIEWER']))).toThrow(
      ForbiddenException,
    );
  });

  it('allows admins and users through editor V2 routes', () => {
    const guard = new V2EditorGuard();
    expect(guard.canActivate(mockContext(['ADMIN']))).toBe(true);
    expect(guard.canActivate(mockContext(['USER']))).toBe(true);
  });

  it('keeps viewers read-only on editor V2 routes', () => {
    const guard = new V2EditorGuard();
    expect(() => guard.canActivate(mockContext(['VIEWER']))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
  });

  it('keeps V2 setup, destructive, and configuration routes on the admin guard', () => {
    const adminMethods: Array<keyof V2Controller> = [
      'refreshPeer',
      'importConnect',
      'importSync',
      'importYears',
      'createPlanningBaseline',
      'importRemoveYear',
      'importBulkDeleteYears',
      'importExcludeYears',
      'importRestoreYears',
      'previewWorkbookImport',
      'previewStatementImport',
      'reconcileImportYear',
      'createImportClearChallenge',
      'clearImportAndScenarios',
      'completeImportYearManually',
      'getOpsFunnel',
      'updateVesinvestGroup',
      'createDepreciationRule',
      'updateDepreciationRule',
      'deleteDepreciationRule',
      'createScenarioDepreciationRule',
      'updateScenarioDepreciationRule',
      'deleteScenarioDepreciationRule',
      'putScenarioClassAllocations',
      'deleteScenario',
    ];

    for (const methodName of adminMethods) {
      const guards = methodGuards(methodName);
      expect(guards).toContain(V2AdminGuard);
      expect(guards).not.toContain(V2EditorGuard);
    }
  });

  it('keeps V2 editor workflow routes on the editor guard', () => {
    const editorMethods: Array<keyof V2Controller> = [
      'createVesinvestPlan',
      'updateVesinvestPlan',
      'cloneVesinvestPlan',
      'syncVesinvestPlanToForecast',
      'upsertTariffPlan',
      'acceptTariffPlan',
      'createScenario',
      'patchScenario',
      'computeScenario',
      'createReport',
    ];

    for (const methodName of editorMethods) {
      const guards = methodGuards(methodName);
      expect(guards).toContain(V2EditorGuard);
      expect(guards).not.toContain(V2AdminGuard);
    }
  });
});
