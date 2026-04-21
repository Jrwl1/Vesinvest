import { registerV2ImportExclusionBehaviorSuite } from './test-support/legacy/v2ImportOverviewLegacySuites';
import { registerV2StatementImportManualYearRegressionSuite } from './test-support/legacy/v2StatementImportManualYearRegressionSuite';
import { registerV2UploadValidationSuite } from './test-support/legacy/v2UploadValidationSuite';
import { registerV2WorkbookPreviewRegressionSuite } from './test-support/legacy/v2WorkbookPreviewRegressionSuite';
import { registerV2YearReconcileBehaviorSuite } from './test-support/legacy/v2YearReconcileBehaviorSuite';

registerV2ImportExclusionBehaviorSuite();
registerV2YearReconcileBehaviorSuite();
registerV2WorkbookPreviewRegressionSuite();
registerV2UploadValidationSuite();
registerV2StatementImportManualYearRegressionSuite();
