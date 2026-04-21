import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe } from 'vitest';
import { resetOverviewTestState } from './overviewTestHarness';
import { registerOverviewReviewFlowSummarySuite } from './overviewReviewFlowSummarySuite';
import { registerOverviewReviewFlowYearReadinessSuite } from './overviewReviewFlowYearReadinessSuite';
import { registerOverviewReviewFlowManualRepairSuite } from './overviewReviewFlowManualRepairSuite';

export function registerOverviewPageV2ReviewFlowSuite() {
  describe('OverviewPageV2 review flow', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

    registerOverviewReviewFlowSummarySuite();
    registerOverviewReviewFlowYearReadinessSuite();
    registerOverviewReviewFlowManualRepairSuite();
  });
}
