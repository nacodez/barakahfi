import { BadRequestException, Logger, type ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/x' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('keeps validation messages for 4xx', () => {
    const { host, status, json } = mockHost();
    filter.catch(new BadRequestException(['email must be an email']), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0]![0]).toMatchObject({
      data: null,
      error: { statusCode: 400, message: ['email must be an email'], path: '/api/v1/x' },
    });
  });

  it('hides internals for unknown errors', () => {
    const { host, status, json } = mockHost();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    filter.catch(new Error('db password is hunter2'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Internal server error' }),
      }),
    );
  });
});
