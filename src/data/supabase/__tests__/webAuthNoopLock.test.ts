import { webAuthNoopLock } from '../webAuthNoopLock';

describe('webAuthNoopLock', () => {
  it('runs fn and returns resolved value', async () => {
    await expect(webAuthNoopLock('k', 10_000, async () => 'ok')).resolves.toBe('ok');
  });

  it('propagates rejection from fn', async () => {
    await expect(
      webAuthNoopLock('k', 10_000, async () => {
        throw new Error('x');
      })
    ).rejects.toThrow('x');
  });
});
