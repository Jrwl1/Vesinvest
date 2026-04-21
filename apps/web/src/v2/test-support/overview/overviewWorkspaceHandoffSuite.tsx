import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe } from 'vitest';
import { resetOverviewTestState } from './overviewTestHarness';
import { registerOverviewWorkspaceInlineEditorSuite } from './overviewWorkspaceInlineEditorSuite';
import { registerOverviewWorkspaceReviewSelectionSuite } from './overviewWorkspaceReviewSelectionSuite';
import { registerOverviewWorkspaceDocumentImportSuite } from './overviewWorkspaceDocumentImportSuite';
import { registerOverviewWorkspacePrefetchSuite } from './overviewWorkspacePrefetchSuite';
import { registerOverviewWorkspaceHandoffDetailsSuite } from './overviewWorkspaceHandoffDetailsSuite';

export function registerOverviewPageV2WorkspaceHandoffSuite() {
  describe('OverviewPageV2 workspace and handoff', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

    registerOverviewWorkspaceInlineEditorSuite();
    registerOverviewWorkspaceReviewSelectionSuite();
    registerOverviewWorkspaceDocumentImportSuite();
    registerOverviewWorkspacePrefetchSuite();
    registerOverviewWorkspaceHandoffDetailsSuite();
  });
}
