import { ComplianceStatus } from '@barakahfi/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const SCREENER_SORTS = ['name', 'symbol', 'marketCap', 'debt', 'status'] as const;

export class ScreenerQuery {
  /** Matches the symbol or the company name. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @IsOptional()
  @IsIn(Object.values(ComplianceStatus))
  status?: ComplianceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  exchange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sector?: string;

  /** Market cap range in US dollars, in billions. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minCapBn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCapBn?: number;

  @IsOptional()
  @IsIn(SCREENER_SORTS)
  sort?: (typeof SCREENER_SORTS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
