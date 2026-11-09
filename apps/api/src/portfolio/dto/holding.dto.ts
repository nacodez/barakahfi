import {
  DATE_ONLY_REGEX,
  NON_NEGATIVE_AMOUNT_REGEX,
  PRICE_REGEX,
  QUANTITY_REGEX,
} from '@barakahfi/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const QTY = { message: 'quantity must be greater than 0 with up to 6 decimal places' };
const PRICE = { message: 'avgBuyPrice must be greater than 0 with up to 4 decimal places' };
const DIV = { message: 'dividendsReceived must be 0 or more with up to 2 decimal places' };
const DATE = { message: 'purchaseDate must be YYYY-MM-DD' };

export class CreateHoldingDto {
  @Transform(upper)
  @IsString()
  @MaxLength(20)
  symbol!: string;

  @IsString()
  @Matches(QUANTITY_REGEX, QTY)
  quantity!: string;

  @IsString()
  @Matches(PRICE_REGEX, PRICE)
  avgBuyPrice!: string;

  @Matches(DATE_ONLY_REGEX, DATE)
  purchaseDate!: string;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_AMOUNT_REGEX, DIV)
  dividendsReceived?: string;
}

/** The stock itself can't change: remove the holding and add another. */
export class UpdateHoldingDto {
  @IsOptional()
  @IsString()
  @Matches(QUANTITY_REGEX, QTY)
  quantity?: string;

  @IsOptional()
  @IsString()
  @Matches(PRICE_REGEX, PRICE)
  avgBuyPrice?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX, DATE)
  purchaseDate?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_AMOUNT_REGEX, DIV)
  dividendsReceived?: string;
}

export const PORTFOLIO_SORTS = [
  'name',
  'quantity',
  'avgBuyPrice',
  'currentPrice',
  'value',
  'gainLoss',
  'gainLossPercent',
  'allocation',
  'status',
] as const;

export class PortfolioQuery {
  @IsOptional()
  @IsIn(PORTFOLIO_SORTS)
  sort?: (typeof PORTFOLIO_SORTS)[number];

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
  @Max(100)
  limit?: number;
}
