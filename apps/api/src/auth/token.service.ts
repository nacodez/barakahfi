import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@barakahfi/shared';
import type { Env } from '../config/env';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './auth.constants';
import type { JwtPayload } from './auth.types';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  signAccess(user: { id: string; email: string; role: Role }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: ACCESS_TTL_SECONDS,
    });
  }

  verifyAccess(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Keyed hash: a leaked tokens table is useless without JWT_REFRESH_SECRET. */
  hashRefresh(token: string): string {
    return createHmac('sha256', this.config.get('JWT_REFRESH_SECRET', { infer: true }))
      .update(token)
      .digest('hex');
  }

  /** Start a new rotation family (login / register). */
  issueRefresh(userId: string, userAgent?: string): Promise<IssuedRefreshToken> {
    return this.createRefresh(this.prisma, userId, randomUUID(), userAgent);
  }

  /**
   * Exchange a refresh token for a new one in the same family.
   * A token can be used exactly once; presenting a used/revoked token means it
   * was stolen or replayed, so the whole family is revoked.
   */
  async rotate(
    rawToken: string,
    userAgent?: string,
  ): Promise<IssuedRefreshToken & { userId: string }> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefresh(rawToken) },
    });
    if (!row || row.expiresAt <= new Date())
      throw new UnauthorizedException('Invalid refresh token');

    const issued = await this.prisma.$transaction(async (tx) => {
      // Atomic claim: only one concurrent request can flip usedAt from null.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: row.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) return null;
      return this.createRefresh(tx, row.userId, row.familyId, userAgent);
    });

    if (issued) return { ...issued, userId: row.userId };

    // Lost the claim. Two tabs refreshing at the same instant is normal, so a reuse
    // inside the leeway window just gets a fresh token. Reuse long after is theft.
    const current = await this.prisma.refreshToken.findUnique({ where: { id: row.id } });
    const leewayMs = this.config.get('REFRESH_REUSE_LEEWAY_SECONDS', { infer: true }) * 1000;
    if (
      current &&
      !current.revokedAt &&
      current.usedAt &&
      Date.now() - current.usedAt.getTime() < leewayMs
    ) {
      const next = await this.createRefresh(this.prisma, row.userId, row.familyId, userAgent);
      return { ...next, userId: row.userId };
    }

    await this.revokeFamily(row.familyId);
    throw new UnauthorizedException('Invalid refresh token');
  }

  async revokeFamilyByToken(rawToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefresh(rawToken) },
      select: { familyId: true },
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefresh(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    familyId: string,
    userAgent?: string,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hashRefresh(token),
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      },
    });
    return { token, expiresAt };
  }
}
