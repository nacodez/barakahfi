import { CategoryType, HalalStatus } from '@barakahfi/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsIn(Object.values(CategoryType))
  type!: CategoryType;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  icon: string = '🏷️';

  @IsIn(Object.values(HalalStatus))
  halalStatus: HalalStatus = 'NEUTRAL';
}

/** Type can't change: existing transactions and budgets depend on it. */
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  icon?: string;

  @IsOptional()
  @IsIn(Object.values(HalalStatus))
  halalStatus?: HalalStatus;
}
