import { Prisma } from '../generated/prisma/client';

/** Anything `new Decimal()` accepts. (Prisma doesn't export `Decimal.Value`.) */
export type DecimalLike = Prisma.Decimal | number | string;

export const D = (v: DecimalLike): Prisma.Decimal => new Prisma.Decimal(v);
