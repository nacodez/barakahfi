import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MonthlyTotalDto } from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MonthlyQuery } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('monthly')
  monthly(
    @CurrentUser() user: JwtPayload,
    @Query() query: MonthlyQuery,
  ): Promise<MonthlyTotalDto[]> {
    return this.reports.monthlyTotals(user.sub, query.months ?? 6);
  }
}
