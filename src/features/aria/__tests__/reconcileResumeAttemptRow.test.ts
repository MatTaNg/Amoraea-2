import { reconcileResumeAttemptRow } from '@features/aria/reconcileResumeAttemptRow';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((table: string) => {
  if (table === 'interview_attempts') {
    return { select: mockSelect, update: mockUpdate };
  }
  throw new Error(`unexpected table ${table}`);
});

jest.mock('@data/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

const mockSaveInterviewToStorage = jest.fn(async () => undefined);
const mockClearInterviewFromStorage = jest.fn(async () => undefined);

jest.mock('@utilities/storage/InterviewStorage', () => ({
  saveInterviewToStorage: (...args: unknown[]) => mockSaveInterviewToStorage(...args),
  clearInterviewFromStorage: (...args: unknown[]) => mockClearInterviewFromStorage(...args),
}));

describe('reconcileResumeAttemptRow', () => {
  const userId = 'user-1';
  const interviewSessionAttemptIdRef = { current: null as string | null };

  beforeEach(() => {
    jest.clearAllMocks();
    interviewSessionAttemptIdRef.current = null;
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('keeps mid-scenario 1 local progress when stored attempt row is missing and bootstrap is deferred', async () => {
    const saved = {
      sessionAttemptId: 'orphan-attempt',
      messages: [
        { role: 'assistant', content: 'Emma and Ryan are at dinner...' },
        { role: 'assistant', content: 'Are you ready?' },
        { role: 'user', content: 'Yes' },
        { role: 'assistant', content: "What's going on between these two?" },
      ],
      scenariosCompleted: [] as number[],
      resumeActiveScenario: 1 as const,
    };

    const result = await reconcileResumeAttemptRow({
      userId,
      saved,
      bootstrapAttemptId: null,
      interviewSessionAttemptIdRef,
    });

    expect(result.kind).toBe('continue');
    expect(mockClearInterviewFromStorage).not.toHaveBeenCalled();
    expect(mockSaveInterviewToStorage).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ sessionAttemptId: undefined }),
    );
    expect(interviewSessionAttemptIdRef.current).toBeNull();
  });

  it('aborts when attempt row is missing and local progress is not resumable', async () => {
    const saved = {
      sessionAttemptId: 'orphan-attempt',
      messages: [{ role: 'assistant', content: 'Welcome to Amoraea.' }],
      scenariosCompleted: [] as number[],
    };

    const result = await reconcileResumeAttemptRow({
      userId,
      saved,
      bootstrapAttemptId: null,
      interviewSessionAttemptIdRef,
    });

    expect(result.kind).toBe('abort_stale');
    expect(mockClearInterviewFromStorage).toHaveBeenCalledWith(userId);
  });
});
