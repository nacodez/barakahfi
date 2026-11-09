import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CategoryDto } from '@barakahfi/shared';
import { Prisma, type Category } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

export const toCategoryDto = (c: Category): CategoryDto => ({
  id: c.id,
  name: c.name,
  type: c.type,
  icon: c.icon,
  halalStatus: c.halalStatus,
  isSystem: c.userId === null,
});

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** System defaults plus the user's own. */
  async list(userId: string): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toCategoryDto);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    try {
      return toCategoryDto(await this.prisma.category.create({ data: { ...dto, userId } }));
    } catch (e) {
      throw this.mapConflict(e);
    }
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.findOwned(userId, id);
    try {
      return toCategoryDto(await this.prisma.category.update({ where: { id }, data: dto }));
    } catch (e) {
      throw this.mapConflict(e);
    }
  }

  /** Transactions keep existing but lose their category (FK is ON DELETE SET NULL). */
  async remove(userId: string, id: string): Promise<null> {
    await this.findOwned(userId, id);
    await this.prisma.category.delete({ where: { id } });
    return null;
  }

  private async findOwned(userId: string, id: string): Promise<Category> {
    const row = await this.prisma.category.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!row) throw new NotFoundException('Category not found');
    if (row.userId === null) throw new ForbiddenException('System categories cannot be changed');
    return row;
  }

  private mapConflict(e: unknown): unknown {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      ? new ConflictException('You already have a category with this name')
      : e;
  }
}
