import { DATE_ONLY_REGEX, POSITIVE_AMOUNT_REGEX, TransactionType } from '@barakahfi/shared';
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

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const AMOUNT_MSG = 'amount must be greater than 0 with up to 2 decimal places';

export class CreateTransactionDto {
  @IsIn(Object.values(TransactionType))
  type!: TransactionType;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  transferAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  /** Decimal string, never a JSON number. */
  @IsString()
  @Matches(POSITIVE_AMOUNT_REGEX, { message: AMOUNT_MSG })
  amount!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @Matches(DATE_ONLY_REGEX, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(Object.values(TransactionType))
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  transferAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @Matches(POSITIVE_AMOUNT_REGEX, { message: AMOUNT_MSG })
  amount?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

export class ListTransactionsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Id of the last item of the previous page. */
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  to?: string;

  @IsOptional()
  @IsIn(Object.values(TransactionType))
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class SummaryQuery {
  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  to?: string;
}
