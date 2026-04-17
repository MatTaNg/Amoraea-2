import {
  WebTtsRequiresUserGestureError,
  isWebTtsRequiresUserGestureError,
} from '../webTtsGestureErrors';

describe('WebTtsRequiresUserGestureError duck-typing', () => {
  it('isWebTtsRequiresUserGestureError is true for class instance', () => {
    const e = new WebTtsRequiresUserGestureError('hello');
    expect(isWebTtsRequiresUserGestureError(e)).toBe(true);
  });

  it('isWebTtsRequiresUserGestureError matches duck-typed object (Metro duplicate module)', () => {
    const e = { name: 'WebTtsRequiresUserGestureError', text: 'hello' };
    expect(isWebTtsRequiresUserGestureError(e)).toBe(true);
  });

  it('rejects non-matching objects', () => {
    expect(isWebTtsRequiresUserGestureError({ name: 'Error', text: 'x' })).toBe(false);
    expect(isWebTtsRequiresUserGestureError(null)).toBe(false);
  });
});
