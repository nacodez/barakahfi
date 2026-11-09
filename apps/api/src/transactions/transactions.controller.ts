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
import type { TransactionDto, TransactionSummaryDto } from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateTransactionDto,
  ListTransactionsQuery,
  SummaryQuery,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListTransactionsQuery) {
    return this.transactions.list(user.sub, query);
  }

  // Declared before ':id' routes so "summary" is never parsed as an id.
  @Get('summary')
  summary(
    @CurrentUser() user: JwtPayload,
    @Query() query: SummaryQuery,
  ): Promise<TransactionSummaryDto[]> {
    return this.transactions.summary(user.sub, query);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<null> {
    return this.transactions.remove(user.sub, id);
  }
}
