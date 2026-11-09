import { BudgetPeriod, DATE_ONLY_REGEX, POSITIVE_AMOUNT_REGEX } from '@barakahfi/shared';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const AMOUNT_MSG = 'amount must be greater than 0 with up to 2 decimal places';

export class CreateBudgetDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @Matches(POSITIVE_AMOUNT_REGEX, { message: AMOUNT_MSG })
  amount!: string;

  @IsIn(Object.values(BudgetPeriod))
  period: BudgetPeriod = 'MONTHLY';

  @Matches(DATE_ONLY_REGEX, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;
}

/** Category and period are fixed once created: change them by making a new budget. */
export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_AMOUNT_REGEX, { message: AMOUNT_MSG })
  amount?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;
}

export class ListBudgetsQuery {
  /** Evaluate budgets as of this date (defaults to today). */
  @IsOptional()
  @Matches(DATE_ONLY_REGEX)
  on?: string;
}
