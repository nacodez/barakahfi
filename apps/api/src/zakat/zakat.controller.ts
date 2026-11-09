import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  ZakatCalculationDto,
  ZakatContextDto,
  ZakatRecordDto,
  ZakatSummaryDto,
} from '@barakahfi/shared';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CalculateZakatDto, SaveZakatDto, UpdateZakatRecordDto } from './dto/zakat.dto';
import { ZakatService } from './zakat.service';

@ApiTags('zakat')
@Controller('zakat')
export class ZakatController {
  constructor(private readonly zakat: ZakatService) {}

  @Get('context')
  context(@CurrentUser() user: JwtPayload): Promise<ZakatContextDto> {
    return this.zakat.context(user.sub);
  }

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload): Promise<ZakatSummaryDto> {
    return this.zakat.summary(user.sub);
  }

  /** A preview: nothing is saved. */
  @Post('calculate')
  calculate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CalculateZakatDto,
  ): Promise<ZakatCalculationDto> {
    return this.zakat.calculate(user.sub, dto);
  }

  @Get('records')
  list(@CurrentUser() user: JwtPayload): Promise<ZakatRecordDto[]> {
    return this.zakat.list(user.sub);
  }

  @Post('records')
  save(@CurrentUser() user: JwtPayload, @Body() dto: SaveZakatDto): Promise<ZakatRecordDto> {
    return this.zakat.save(user.sub, dto);
  }

  @Patch('records/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZakatRecordDto,
  ): Promise<ZakatRecordDto> {
    return this.zakat.update(user.sub, id, dto);
  }
}
