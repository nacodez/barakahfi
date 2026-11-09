import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { BudgetDto } from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, ListBudgetsQuery, UpdateBudgetDto } from './dto/budget.dto';

@ApiTags('budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListBudgetsQuery): Promise<BudgetDto[]> {
    return this.budgets.list(user.sub, query.on);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBudgetDto): Promise<BudgetDto> {
    return this.budgets.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetDto> {
    return this.budgets.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<null> {
    return this.budgets.remove(user.sub, id);
  }
}
