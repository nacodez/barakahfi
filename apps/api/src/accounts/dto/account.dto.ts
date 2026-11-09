import { AccountType, CURRENCY_REGEX, LIMITS } from '@barakahfi/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAccountDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITS.ACCOUNT_NAME_MAX)
  name!: string;

  @IsIn(Object.values(AccountType))
  type!: AccountType;

  @Matches(CURRENCY_REGEX, { message: 'currency must be an ISO 4217 code, e.g. AED' })
  currency!: string;

  /** Decimal string, max 2 dp. Never a JSON number (float rounding). */
  @IsString()
  @Matches(/^-?\d{1,13}(\.\d{1,2})?$/, {
    message: 'balance must be a decimal string with up to 2 places',
  })
  balance!: string;

  @IsOptional()
  @IsBoolean()
  isZakatable?: boolean;
}

/** Balance and type are deliberately not editable: balance changes only through transactions. */
export class UpdateAccountDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITS.ACCOUNT_NAME_MAX)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isZakatable?: boolean;
}
