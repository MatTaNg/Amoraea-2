import {
  buildEditProfileFormSnapshot,
  editProfileFormSnapshotsEqual,
  patchEditProfileFormSnapshotLocation,
  pickTrackedEditProfileDraftFields,
} from '@/screens/profile/editProfile/editProfileDraftSnapshot';
import { DEFAULT_ONBOARDING_LIFE_DOMAINS } from '@/shared/components/LifeDomainDistribution';

describe('editProfileDraftSnapshot', () => {
  const baseInput = {
    draft: {
      name: 'Alex',
      location: 'Austin, TX',
      photos: ['https://x/1.jpg'],
      updatedAt: '2026-01-01T00:00:00Z',
    },
    photoUrls: ['https://x/1.jpg'],
    attractedUi: ['Women'],
    sexInterestSelected: ['kink-friendly'],
    lifeDomainsState: { ...DEFAULT_ONBOARDING_LIFE_DOMAINS },
    weightKgPick: 74.8,
    heightCmPick: 175,
    typologyValues: { 'ECR-36-q1': 'Agree' },
    matchPrefs: { ageMin: 25 },
    prefPhysicalCompatImportance: 'Important',
    prefPartnerSharesSexualInterests: 'Yes',
    prefPartnerHasChildren: 'No preference',
    prefPartnerPoliticalAlignmentImportance: 'Somewhat important',
    archetypeSelection: ['explorer', 'creator'] as ['explorer', 'creator'],
    lifeDomainAnswers: { finance: { yearlyIncome: '100k' } },
    validatedBirthLocation: 'Denver, CO',
    profilePrompts: [],
  };

  it('ignores untracked draft keys and draft.photos', () => {
    const left = buildEditProfileFormSnapshot(baseInput);
    const right = buildEditProfileFormSnapshot({
      ...baseInput,
      draft: {
        ...baseInput.draft,
        photos: ['file:///local.jpg'],
        updatedAt: '2026-02-01T00:00:00Z',
      },
    });
    expect(editProfileFormSnapshotsEqual(left, right)).toBe(true);
  });

  it('detects edits to tracked fields', () => {
    const saved = buildEditProfileFormSnapshot(baseInput);
    const edited = buildEditProfileFormSnapshot({
      ...baseInput,
      draft: { ...baseInput.draft, displayName: 'Jordan' },
    });
    expect(editProfileFormSnapshotsEqual(saved, edited)).toBe(false);
  });

  it('tracks displayName separately from name', () => {
    const saved = pickTrackedEditProfileDraftFields({ name: 'Alex' });
    const edited = pickTrackedEditProfileDraftFields({
      name: 'Alex',
      displayName: 'Alex',
    });
    expect(saved).toEqual({ name: 'Alex' });
    expect(edited).toEqual({ name: 'Alex', displayName: 'Alex' });
  });

  it('patches auto-refreshed location into the saved snapshot', () => {
    const saved = buildEditProfileFormSnapshot(baseInput);
    const patched = patchEditProfileFormSnapshotLocation(saved, 'San Diego, CA');
    const current = buildEditProfileFormSnapshot({
      ...baseInput,
      draft: { ...baseInput.draft, location: 'San Diego, CA' },
    });
    expect(editProfileFormSnapshotsEqual(patched, current)).toBe(true);
  });
});
