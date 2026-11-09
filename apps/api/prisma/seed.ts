import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { SAMPLE_DATA_SOURCE } from '@barakahfi/shared';
import {
  Prisma,
  PrismaClient,
  type CategoryType,
  type HalalStatus,
} from '../src/generated/prisma/client';
import { screen } from '../src/screener/screening.engine';
import { SEED_ASSETS } from './seed-data/assets';

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
  await seedAssets();
}

/** Idempotent: re-running keeps prices fresh and never duplicates a screening row. */
async function seedAssets() {
  for (const a of SEED_ASSETS) {
    // Stored in USD; AED is pegged at 3.6725 per dollar.
    const fxToUsd = a.currency === 'AED' ? 1 / 3.6725 : 1;
    const marketCap = new Prisma.Decimal(a.price)
      .mul(a.sharesMn)
      .mul(1_000_000)
      .mul(fxToUsd)
      .toDecimalPlaces(0);
    const data = {
      name: a.name,
      type: 'STOCK' as const,
      exchange: a.exchange,
      sector: a.sector,
      marketCap,
      currentPrice: a.price,
      previousClose: a.previousClose,
      currency: a.currency,
    };
    const asset = await prisma.asset.upsert({
      where: { symbol: a.symbol },
      create: { symbol: a.symbol, ...data },
      update: data,
    });

    const hasScreening = await prisma.screeningResult.findFirst({
      where: { assetId: asset.id },
      select: { id: true },
    });
    if (hasScreening) continue;

    const outcome = screen({
      primaryActivity: a.prohibited ? 'PROHIBITED' : 'PERMISSIBLE',
      ...(a.prohibited ? { prohibitedReason: a.prohibited } : {}),
      debtRatio: a.debt,
      cashRatio: a.cash,
      receivablesRatio: a.receivables,
      haramRevenueRatio: a.haramRevenue,
    });
    await prisma.screeningResult.create({
      data: {
        assetId: asset.id,
        complianceStatus: outcome.status,
        debtRatio: a.debt,
        cashRatio: a.cash,
        receivablesRatio: a.receivables,
        revenueScreening: {
          haramRevenueRatio: a.haramRevenue.toFixed(4),
          sources: a.haramSources,
          primaryActivity: a.prohibited ? 'PROHIBITED' : 'PERMISSIBLE',
          ...(a.prohibited ? { prohibitedReason: a.prohibited } : {}),
        },
        purificationPercent: outcome.purificationPercent,
        source: SAMPLE_DATA_SOURCE,
      },
    });
  }
  console.log(`Seeded ${SEED_ASSETS.length} sample assets with sample screening data`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
