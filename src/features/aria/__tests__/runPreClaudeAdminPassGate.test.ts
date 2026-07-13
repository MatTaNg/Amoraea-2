import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  ADMIN_PASS_EMAIL,
  ADMIN_PASS_PHRASE,
} from '@features/aria/interviewAdminConfig';
import { runPreClaudeAdminPassGate } from '@features/aria/runPreClaudeAdminPassGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const mockGetSession = jest.fn();
const mockUpdateUserInterviewApplication = jest.fn();
const mockShowSimpleAlert = jest.fn();

jest.mock('@data/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

jest.mock('@data/repos/usersInterviewRepo', () => ({
  updateUserInterviewApplication: (...args: unknown[]) =>
    mockUpdateUserInterviewApplication(...args),
}));

jest.mock('@utilities/alerts/confirmDialog', () => ({
  showSimpleAlert: (...args: unknown[]) => mockShowSimpleAlert(...args),
}));

describe('runPreClaudeAdminPassGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: ADMIN_PASS_EMAIL } } },
    });
    mockUpdateUserInterviewApplication.mockResolvedValue(undefined);
  });

  it('returns handled:false when not on the interview app route', async () => {
    const deps = createMockPreClaudeDeps({ isInterviewAppRoute: false });

    const result = await runPreClaudeAdminPassGate(deps, ADMIN_PASS_PHRASE);

    expect(result).toEqual({ handled: false });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('returns handled:false when the phrase does not match', async () => {
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeAdminPassGate(deps, 'not the admin phrase');

    expect(result).toEqual({ handled: false });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('returns handled:false when the signed-in email is not the admin email', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'other@example.com' } } },
    });
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeAdminPassGate(deps, ADMIN_PASS_PHRASE);

    expect(result).toEqual({ handled: false });
    expect(mockUpdateUserInterviewApplication).not.toHaveBeenCalled();
  });

  it('approves onboarding and shows results when admin email and phrase match', async () => {
    const setResults = jest.fn();
    const setStatus = jest.fn();
    const setInterviewStatus = jest.fn();
    const setVoiceState = jest.fn();
    const invalidateProfileQuery = jest.fn();
    const deps = createMockPreClaudeDeps({
      setResults,
      setStatus,
      setInterviewStatus,
      setVoiceState,
      invalidateProfileQuery,
    });

    const result = await runPreClaudeAdminPassGate(deps, ADMIN_PASS_PHRASE);

    expect(result).toEqual({ handled: true });
    expect(mockUpdateUserInterviewApplication).toHaveBeenCalledWith(deps.userId, {
      applicationStatus: 'approved',
      onboardingStage: 'complete',
    });
    expect(invalidateProfileQuery).toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
    expect(setInterviewStatus).toHaveBeenCalledWith('congratulations');
    expect(setStatus).toHaveBeenCalledWith('results');
    expect(setResults).toHaveBeenCalledWith(
      expect.objectContaining({
        interviewSummary: 'Admin pass — interview skipped. Scores are illustrative.',
        gateResult: expect.objectContaining({ pass: true }),
      }),
    );
  });

  it('shows an alert and still halts the turn when persistence fails', async () => {
    mockUpdateUserInterviewApplication.mockRejectedValue(new Error('network down'));
    const setVoiceState = jest.fn();
    const deps = createMockPreClaudeDeps({ setVoiceState });

    const result = await runPreClaudeAdminPassGate(deps, ADMIN_PASS_PHRASE);

    expect(result).toEqual({ handled: true });
    expect(mockShowSimpleAlert).toHaveBeenCalledWith('Admin pass failed', 'network down');
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });
});
