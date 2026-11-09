import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const GRAMS = /^\d{1,7}(\.\d{1,3})?$/;
const amountMsg = { message: 'must be 0 or more with up to 2 decimal places' };
const gramsMsg = { message: 'must be grams with up to 3 decimal places' };

export class CalculateZakatDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  accountIds: string[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  holdingIds: string[] = [];

  @IsOptional()
  @IsString()
  @Matches(AMOUNT, amountMsg)
  cashOnHand: string = '0';

  @IsOptional()
  @IsString()
  @Matches(AMOUNT, amountMsg)
  receivables: string = '0';

  @IsOptional()
  @IsString()
  @Matches(GRAMS, gramsMsg)
  goldJewelryGrams: string = '0';

  @IsOptional()
  @IsString()
  @Matches(GRAMS, gramsMsg)
  silverGrams: string = '0';

  @IsOptional()
  @IsString()
  @Matches(AMOUNT, amountMsg)
  otherAssets: string = '0';

  @IsOptional()
  @IsString()
  @Matches(AMOUNT, amountMsg)
  liabilities: string = '0';

  @IsOptional()
  @IsIn(['GOLD', 'SILVER'])
  nisabMethod?: 'GOLD' | 'SILVER';
}

export class SaveZakatDto extends CalculateZakatDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateZakatRecordDto {
  @IsOptional()
  @IsString()
  @Matches(AMOUNT, amountMsg)
  zakatPaid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
