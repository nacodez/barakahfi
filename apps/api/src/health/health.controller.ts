import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Database down returns 503. Redis down returns 200 "degraded", since it is only a cache. */
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    const redis = await this.cache.status();
    return {
      status: redis === 'down' ? 'degraded' : 'ok',
      db: 'up',
      redis,
      uptime: Math.round(process.uptime()),
    };
  }
}
