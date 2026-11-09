import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccountDto } from '@barakahfi/shared';
import type { Account } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

export function toAccountDto(a: Account): AccountDto {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: a.balance.toFixed(2),
    isZakatable: a.isZakatable,
    archivedAt: a.archivedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AccountDto[]> {
    const rows = await this.prisma.account.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toAccountDto);
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    const row = await this.prisma.account.create({ data: { ...dto, userId } });
    return toAccountDto(row);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountDto> {
    await this.findOwned(userId, id);
    return toAccountDto(await this.prisma.account.update({ where: { id }, data: dto }));
  }

  /** Soft delete: keeps history intact. */
  async archive(userId: string, id: string): Promise<AccountDto> {
    await this.findOwned(userId, id);
    return toAccountDto(
      await this.prisma.account.update({ where: { id }, data: { archivedAt: new Date() } }),
    );
  }

  /** Scoping by userId makes other users' accounts indistinguishable from missing ones (404, not 403). */
  private async findOwned(userId: string, id: string): Promise<Account> {
    const row = await this.prisma.account.findFirst({ where: { id, userId, archivedAt: null } });
    if (!row) throw new NotFoundException('Account not found');
    return row;
  }
}
