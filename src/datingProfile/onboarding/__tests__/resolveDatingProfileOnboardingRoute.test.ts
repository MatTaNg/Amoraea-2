import {
  resolveDatingProfileOnboardingEntryRoute,
  shouldShowRelationshipTypologyIntro,
} from '@/datingProfile/onboarding/resolveDatingProfileOnboardingRoute';

jest.mock('@/data/repos/profilesRepo', () => ({
  profilesRepo: {
    getProfile: jest.fn(),
  },
}));

jest.mock('@/datingProfile/screens/onboarding/modals/services/modalOnboardingService', () => ({
  modalOnboardingService: {
    getProgress: jest.fn(),
  },
}));

jest.mock('@/data/services/assessmentService', () => {
  const BATTERY = ['SEXUAL_COMMUNICATION', 'PVQ-21', 'CONFLICT-30', 'ECR-36'];
  return {
    getCompletedAssessments: jest.fn(),
    getFirstIncompleteAssessment: jest.fn(),
    FIRST_DATING_PROFILE_ASSESSMENT_ID: 'SEXUAL_COMMUNICATION',
    isDatingProfileTypologyBatteryComplete: (list: string[]) =>
      BATTERY.every((id) => list.includes(id)),
    syncProfileIfTypologyBatteryComplete: jest.fn(),
    isActiveAssessmentId: jest.fn(
      (id: string) =>
        id === 'SEXUAL_COMMUNICATION' ||
        id === 'PVQ-21' ||
        id === 'CONFLICT-30' ||
        id === 'ECR-36',
    ),
    resolveActiveAssessmentId: jest.fn((instrument: string | null, completed: string[] = []) => {
      if (
        instrument === 'SEXUAL_COMMUNICATION' ||
        instrument === 'PVQ-21' ||
        instrument === 'CONFLICT-30' ||
        instrument === 'ECR-36'
      ) {
        return instrument;
      }
      return completed.includes('SEXUAL_COMMUNICATION') ? 'PVQ-21' : 'SEXUAL_COMMUNICATION';
    }),
    markAssessmentsStarted: jest.fn(),
  };
});

import { profilesRepo } from '@/data/repos/profilesRepo';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';
import {
  getCompletedAssessments,
  getFirstIncompleteAssessment,
  syncProfileIfTypologyBatteryComplete,
} from '@/data/services/assessmentService';

const getProfileMock = profilesRepo.getProfile as jest.Mock;
const getProgressMock = modalOnboardingService.getProgress as jest.Mock;
const getCompletedMock = getCompletedAssessments as jest.Mock;
const getFirstIncompleteMock = getFirstIncompleteAssessment as jest.Mock;
const syncBatteryMock = syncProfileIfTypologyBatteryComplete as jest.Mock;

describe('resolveDatingProfileOnboardingEntryRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFirstIncompleteMock.mockReturnValue('PVQ-21');
    getProgressMock.mockResolvedValue({ success: true, data: { currentStep: 'photos' } });
  });

  it('routes new profile creators to the typology intro first', async () => {
    getProfileMock.mockResolvedValue({
      success: true,
      data: {
        onboardingCompleted: false,
        assessmentsCompleted: false,
        assessmentsStarted: false,
        currentAssessment: null,
      },
    });
    getCompletedMock.mockResolvedValue({ success: true, data: [] });

    const route = await resolveDatingProfileOnboardingEntryRoute('user-1');
    expect(route.screen).toBe('DatingTypologyIntro');
  });

  it('skips retired relationship traits and resumes at the next active instrument', async () => {
    getProfileMock.mockResolvedValue({
      success: true,
      data: {
        onboardingCompleted: false,
        assessmentsCompleted: false,
        assessmentsStarted: true,
        currentAssessment: 'RELATIONSHIP_TRAITS_8',
      },
    });
    getCompletedMock.mockResolvedValue({
      success: true,
      data: ['RELATIONSHIP_TRAITS_8'],
    });

    const route = await resolveDatingProfileOnboardingEntryRoute('user-1');
    expect(route.screen).toBe('DatingInstrument');
    expect(route.params).toEqual({ instrument: 'SEXUAL_COMMUNICATION' });
  });

  it('skips instruments when relationship validation battery is already complete', async () => {
    getProfileMock.mockResolvedValue({
      success: true,
      data: {
        onboardingCompleted: false,
        assessmentsCompleted: false,
        assessmentsStarted: false,
        currentAssessment: null,
      },
    });
    getCompletedMock.mockResolvedValue({
      success: true,
      data: ['SEXUAL_COMMUNICATION', 'PVQ-21', 'CONFLICT-30', 'ECR-36'],
    });

    const route = await resolveDatingProfileOnboardingEntryRoute('user-1');
    expect(syncBatteryMock).toHaveBeenCalledWith(
      'user-1',
      ['SEXUAL_COMMUNICATION', 'PVQ-21', 'CONFLICT-30', 'ECR-36'],
      expect.objectContaining({ assessmentsCompleted: false }),
    );
    expect(route.screen).toBe('DatingModals');
  });
});

describe('shouldShowRelationshipTypologyIntro', () => {
  it('returns true only for untouched assessment batteries', () => {
    expect(shouldShowRelationshipTypologyIntro(null, 0)).toBe(true);
    expect(
      shouldShowRelationshipTypologyIntro(
        { assessmentsStarted: false, currentAssessment: null },
        0,
      ),
    ).toBe(true);
    expect(
      shouldShowRelationshipTypologyIntro(
        { assessmentsStarted: true, currentAssessment: null },
        0,
      ),
    ).toBe(false);
    expect(
      shouldShowRelationshipTypologyIntro(
        { assessmentsStarted: false, currentAssessment: null },
        1,
      ),
    ).toBe(false);
  });
});
