import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe } from 'vitest';
import { resetOverviewTestState } from './overviewTestHarness';
import { registerOverviewConnectImportSearchSelectionSuite } from './overviewConnectImportSearchSelectionSuite';
import { registerOverviewConnectImportExecutionSuite } from './overviewConnectImportExecutionSuite';
import { registerOverviewConnectImportRecoverySuite } from './overviewConnectImportRecoverySuite';

export function registerOverviewPageV2ConnectImportSuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

    registerOverviewConnectImportSearchSelectionSuite();
    registerOverviewConnectImportExecutionSuite();
    registerOverviewConnectImportRecoverySuite();
  });
}
