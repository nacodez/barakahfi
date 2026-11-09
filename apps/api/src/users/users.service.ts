import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserDto } from '@barakahfi/shared';
import { parseDateOnly } from '../common/date.util';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { toUserDto } from './users.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    await this.getProfile(userId);
    const { zakatStartDate, ...rest } = dto;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(zakatStartDate !== undefined && {
          zakatStartDate: zakatStartDate === null ? null : parseDateOnly(zakatStartDate),
        }),
      },
    });
    return toUserDto(user);
  }
}
