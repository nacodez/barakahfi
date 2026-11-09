import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type CategoryType, type HalalStatus } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const defaults: Array<{
  name: string;
  type: CategoryType;
  icon: string;
  halalStatus: HalalStatus;
}> = [
  { name: 'Salary', type: 'INCOME', icon: '💼', halalStatus: 'HALAL' },
  { name: 'Business', type: 'INCOME', icon: '🏪', halalStatus: 'HALAL' },
  { name: 'Dividends', type: 'INCOME', icon: '📈', halalStatus: 'NEUTRAL' },
  { name: 'Rental Income', type: 'INCOME', icon: '🏠', halalStatus: 'HALAL' },
  { name: 'Interest (to purify)', type: 'INCOME', icon: '⚠️', halalStatus: 'HARAM' },
  { name: 'Groceries', type: 'EXPENSE', icon: '🛒', halalStatus: 'NEUTRAL' },
  { name: 'Rent', type: 'EXPENSE', icon: '🔑', halalStatus: 'NEUTRAL' },
  { name: 'Utilities', type: 'EXPENSE', icon: '💡', halalStatus: 'NEUTRAL' },
  { name: 'Transport', type: 'EXPENSE', icon: '🚗', halalStatus: 'NEUTRAL' },
  { name: 'Dining Out', type: 'EXPENSE', icon: '🍽️', halalStatus: 'NEUTRAL' },
  { name: 'Education', type: 'EXPENSE', icon: '📚', halalStatus: 'NEUTRAL' },
  { name: 'Healthcare', type: 'EXPENSE', icon: '🩺', halalStatus: 'NEUTRAL' },
  { name: 'Sadaqah', type: 'EXPENSE', icon: '🤲', halalStatus: 'HALAL' },
  { name: 'Zakat', type: 'EXPENSE', icon: '🕌', halalStatus: 'HALAL' },
  { name: 'Purification', type: 'EXPENSE', icon: '💧', halalStatus: 'HALAL' },
];

async function main() {
  // Postgres treats NULLs as distinct in unique indexes, so upsert on
  // (userId, name, type) doesn't work for system rows; do find-or-create.
  for (const c of defaults) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: c.name, type: c.type },
    });
    if (!existing) await prisma.category.create({ data: { ...c, userId: null } });
  }
  console.log(`Seeded ${defaults.length} system categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
