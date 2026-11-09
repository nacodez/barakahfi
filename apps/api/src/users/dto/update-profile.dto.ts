import { CURRENCY_REGEX, LIMITS } from '@barakahfi/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(LIMITS.NAME_MAX)
  name?: string;

  @IsOptional()
  @Matches(CURRENCY_REGEX, { message: 'currency must be an ISO 4217 code, e.g. AED' })
  currency?: string;

  @IsOptional()
  @IsIn(['GOLD', 'SILVER'])
  nisabMethod?: 'GOLD' | 'SILVER';
}
