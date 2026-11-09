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
import { ApiTags } from '@nestjs/swagger';
import type { HoldingDto } from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateHoldingDto, PortfolioQuery, UpdateHoldingDto } from './dto/holding.dto';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller()
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('portfolio')
  list(@CurrentUser() user: JwtPayload, @Query() query: PortfolioQuery) {
    return this.portfolio.list(user.sub, query);
  }

  @Post('holdings')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateHoldingDto): Promise<HoldingDto> {
    return this.portfolio.create(user.sub, dto);
  }

  @Patch('holdings/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHoldingDto,
  ): Promise<HoldingDto> {
    return this.portfolio.update(user.sub, id, dto);
  }

  @Delete('holdings/:id')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<null> {
    return this.portfolio.remove(user.sub, id);
  }
}
