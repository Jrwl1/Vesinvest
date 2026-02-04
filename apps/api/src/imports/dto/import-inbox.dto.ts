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

/** Sheet classification from upload (Facit-first). */
export type SheetKind = 'ASSET_CANDIDATE' | 'REFERENCE' | 'EMPTY' | 'UNKNOWN';

export interface ImportInboxGroup {
  sheetId: string;
  sheetName: string;
  dataRowCount: number;
  recommendedMethod: 'quick' | 'mapping';
  signals: InboxSignal[];
  detectedColumnsSummary?: InboxDetectedColumnSummary[];
  /** Classification: reference sheets (e.g. Förklaringar) are ignored by default */
  kind?: SheetKind;
  kindReason?: string;
  /** When true, quick import is disabled with a friendly reason (e.g. reference sheet) */
  quickImportDisabledReason?: string;
}

export interface ImportInboxDto {
  importId: string;
  filename: string;
  uploadedAt: string;
  groups: ImportInboxGroup[];
}
