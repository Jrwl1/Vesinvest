import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsInt,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualYearFinancialsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liikevaihto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  aineetJaPalvelut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  henkilostokulut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liiketoiminnanMuutKulut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  poistot?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arvonalentumiset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rahoitustuototJaKulut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tilikaudenYliJaama?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  omistajatuloutus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  omistajanTukiKayttokustannuksiin?: number;
}

export class ManualYearPricesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waterUnitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastewaterUnitPrice!: number;
}

export class ManualYearVolumesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  soldWaterVolume!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  soldWastewaterVolume!: number;
}

export class ManualYearInvestmentsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  investoinninMaara!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  korvausInvestoinninMaara!: number;
}

export class ManualYearEnergyDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prosessinKayttamaSahko!: number;
}

export class ManualYearNetworkDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  verkostonPituus!: number;
}

export class ManualYearStatementImportDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  confidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scannedPageCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matchedFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];
}

export class ManualYearQdisImportDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  confidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scannedPageCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  matchedFields?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  warnings?: string[];
}

const WORKBOOK_IMPORT_KINDS = ['kva_import', 'excel_import'] as const;
const WORKBOOK_ACTIONS = ['keep_veeti', 'apply_workbook'] as const;
const WORKBOOK_SOURCE_FIELDS = [
  'Liikevaihto',
  'AineetJaPalvelut',
  'Henkilostokulut',
  'Poistot',
  'LiiketoiminnanMuutKulut',
  'TilikaudenYliJaama',
] as const;

export class ManualYearWorkbookCandidateDto {
  @IsString()
  @IsIn(WORKBOOK_SOURCE_FIELDS)
  sourceField!: (typeof WORKBOOK_SOURCE_FIELDS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  workbookValue?: number;

  @IsString()
  @IsIn(WORKBOOK_ACTIONS)
  action!: (typeof WORKBOOK_ACTIONS)[number];
}

export class ManualYearWorkbookImportDto {
  @IsOptional()
  @IsString()
  @IsIn(WORKBOOK_IMPORT_KINDS)
  kind?: (typeof WORKBOOK_IMPORT_KINDS)[number];

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sheetName?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1900, { each: true })
  matchedYears?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(WORKBOOK_SOURCE_FIELDS, { each: true })
  matchedFields?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(WORKBOOK_SOURCE_FIELDS, { each: true })
  confirmedSourceFields?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualYearWorkbookCandidateDto)
  candidateRows?: ManualYearWorkbookCandidateDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  warnings?: string[];
}

export class ManualYearCompletionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  year!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearFinancialsDto)
  financials?: ManualYearFinancialsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearPricesDto)
  prices?: ManualYearPricesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearVolumesDto)
  volumes?: ManualYearVolumesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearInvestmentsDto)
  investments?: ManualYearInvestmentsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearEnergyDto)
  energy?: ManualYearEnergyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearNetworkDto)
  network?: ManualYearNetworkDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearStatementImportDto)
  statementImport?: ManualYearStatementImportDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearQdisImportDto)
  qdisImport?: ManualYearQdisImportDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearWorkbookImportDto)
  workbookImport?: ManualYearWorkbookImportDto;
}
