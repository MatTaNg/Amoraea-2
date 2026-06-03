import {
  resolveDatingProfileOnboardingEntryRoute,
  shouldShowRelationshipTypologyIntro,
} from '@/datingProfile/onboarding/resolveDatingProfileOnboardingRoute';

jest.mock('@/data/repos/profilesRepo', () => ({
  profilesRepo: {
    getProfile: jest.fn(),
  },
}));

jest.mock('@/data/services/assessmentService', () => ({
  getCompletedAssessments: jest.fn(),
  getFirstIncompleteAssessment: jest.fn(),
  FIRST_DATING_PROFILE_ASSESSMENT_ID: 'SEXUAL_COMMUNICATION',
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
}));

import { profilesRepo } from '@/data/repos/profilesRepo';
import { getCompletedAssessments, getFirstIncompleteAssessment } from '@/data/services/assessmentService';

const getProfileMock = profilesRepo.getProfile as jest.Mock;
const getCompletedMock = getCompletedAssessments as jest.Mock;
const getFirstIncompleteMock = getFirstIncompleteAssessment as jest.Mock;

describe('resolveDatingProfileOnboardingEntryRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFirstIncompleteMock.mockReturnValue('PVQ-21');
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
