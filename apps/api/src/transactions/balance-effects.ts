import { Prisma } from '../generated/prisma/client';

export interface LedgerEntry {
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  accountId: string;
  transferAccountId: string | null;
  amount: Prisma.Decimal;
}

export interface BalanceEffect {
  accountId: string;
  delta: Prisma.Decimal;
}

/**
 * How one ledger entry moves account balances. `amount` is always positive;
 * the type decides the direction. Reversing an entry just negates every delta.
 */
export function balanceEffects(entry: LedgerEntry): BalanceEffect[] {
  switch (entry.type) {
    case 'INCOME':
      return [{ accountId: entry.accountId, delta: entry.amount }];
    case 'EXPENSE':
      return [{ accountId: entry.accountId, delta: entry.amount.neg() }];
    case 'TRANSFER':
      if (!entry.transferAccountId) throw new Error('TRANSFER without a destination account');
      return [
        { accountId: entry.accountId, delta: entry.amount.neg() },
        { accountId: entry.transferAccountId, delta: entry.amount },
      ];
  }
}
