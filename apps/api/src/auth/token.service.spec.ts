import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';

const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

function setup() {
  const refreshToken = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn().mockResolvedValue({}),
  };
  const prisma = {
    refreshToken,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ refreshToken })),
  };
  const config = { get: (k: string) => SECRETS[k] };
  const service = new TokenService({} as never, config as never, prisma as never);
  return { service, refreshToken };
}

const row = (over: Partial<{ expiresAt: Date }> = {}) => ({
  id: 'row-1',
  userId: 'user-1',
  familyId: 'family-1',
  expiresAt: new Date(Date.now() + 60_000),
  ...over,
});

describe('TokenService.rotate', () => {
  it('rotates a valid token within the same family', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(row());
    refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.rotate('raw-token');

    expect(result.userId).toBe('user-1');
    expect(result.token).not.toBe('raw-token');
    expect(refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', familyId: 'family-1' }),
    });
  });

  it('revokes the whole family when a used token is replayed', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(row());
    refreshToken.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 3 });

    await expect(service.rotate('stolen')).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshToken.create).not.toHaveBeenCalled();
    expect(refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects unknown tokens', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.rotate('nope')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired tokens without touching the database further', async () => {
    const { service, refreshToken } = setup();
    refreshToken.findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1) }));
    await expect(service.rotate('old')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('TokenService.hashRefresh', () => {
  it('is deterministic and never returns the raw token', () => {
    const { service } = setup();
    expect(service.hashRefresh('x')).toBe(service.hashRefresh('x'));
    expect(service.hashRefresh('x')).not.toContain('x');
    expect(service.hashRefresh('x')).toHaveLength(64);
  });
});
