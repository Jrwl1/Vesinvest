import {
  registerV2ImportExclusionBehaviorSuite,
  registerV2StatementImportManualYearRegressionSuite,
  registerV2UploadValidationSuite,
  registerV2WorkbookPreviewRegressionSuite,
  registerV2YearReconcileBehaviorSuite,
} from './test-support/v2ServiceLegacySuites';

registerV2ImportExclusionBehaviorSuite();
registerV2YearReconcileBehaviorSuite();
registerV2WorkbookPreviewRegressionSuite();
registerV2UploadValidationSuite();
registerV2StatementImportManualYearRegressionSuite();
