import { resolveAriaInterviewScreenRoutePreamble } from '@features/aria/resolveAriaInterviewScreenRoutePreamble';

describe('resolveAriaInterviewScreenRoutePreamble', () => {
  it('prefers route userId over auth user id', () => {
    expect(
      resolveAriaInterviewScreenRoutePreamble(
        { params: { userId: 'route-user' } },
        'auth-user',
      ),
    ).toEqual({
      userId: 'route-user',
      fromValidationTrack: false,
    });
  });

  it('falls back to auth user id when route omits userId', () => {
    expect(resolveAriaInterviewScreenRoutePreamble({ params: {} }, 'auth-user')).toEqual({
      userId: 'auth-user',
      fromValidationTrack: false,
    });
  });

  it('returns empty userId when route and auth are missing', () => {
    expect(resolveAriaInterviewScreenRoutePreamble({})).toEqual({
      userId: '',
      fromValidationTrack: false,
    });
  });

  it('reads validation-track handoff only when explicitly true', () => {
    expect(
      resolveAriaInterviewScreenRoutePreamble({
        params: { fromValidationTrack: true },
      }),
    ).toEqual({
      userId: '',
      fromValidationTrack: true,
    });

    expect(
      resolveAriaInterviewScreenRoutePreamble({
        params: { fromValidationTrack: false },
      }),
    ).toEqual({
      userId: '',
      fromValidationTrack: false,
    });
  });
});
