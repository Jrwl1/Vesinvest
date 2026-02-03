export class ExcelSheetDto {
  id!: string;
  sheetName!: string;
  headers!: string[];
  rowCount!: number;
  sampleRows?: Record<string, unknown>[];
}

export class ExcelImportDto {
  id!: string;
  orgId!: string;
  filename!: string;
  status!: 'pending' | 'mapped' | 'imported' | 'failed';
  uploadedAt!: Date;
  sheets!: ExcelSheetDto[];
}

export class UploadResponseDto {
  message!: string;
  import!: ExcelImportDto;
}

export class ImportListResponseDto {
  imports!: ExcelImportDto[];
}
