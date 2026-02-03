/**
 * Response shape for GET /imports/:id/inbox
 * Inbox view model: one group per sheet with signals and recommended method.
 */
export type InboxSignalStatus = 'good' | 'warn' | 'missing';

export interface InboxSignal {
  label: string;
  status: InboxSignalStatus;
}

export interface InboxDetectedColumnSummary {
  field: string;
  sourceColumn: string;
}

export interface ImportInboxGroup {
  sheetId: string;
  sheetName: string;
  dataRowCount: number;
  recommendedMethod: 'quick' | 'mapping';
  signals: InboxSignal[];
  detectedColumnsSummary?: InboxDetectedColumnSummary[];
}

export interface ImportInboxDto {
  importId: string;
  filename: string;
  uploadedAt: string;
  groups: ImportInboxGroup[];
}
