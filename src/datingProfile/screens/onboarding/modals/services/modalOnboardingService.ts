import { supabase } from '@/data/supabaseClient';
import { Result } from '@/src/types';
import { OnboardingProgress, OnboardingData } from '../types';
import { profilesRepo } from '@/data/repos/profilesRepo';
import { mapGenderToUi } from '@/shared/utils/genderMapper';
import { normalizeWantKidsToYesNo } from '@/shared/constants/filterOptions';
import {
  buildHeightWeightProfileFields,
  mapRelationshipStyleUiToDb,
  mapRelationshipStyleUiToRelationshipType,
} from '@/screens/profile/editProfile/editProfileService';
import { normalizePartnerPoliticalAlignmentToYesNo } from '@/screens/profile/editProfile/constants';

class ModalOnboardingService {
  /**
   * Merge profile row with saved onboarding draft so completion checks match
   * answers that exist only in `onboarding_progress.onboarding_data` until profile sync catches up.
   */
  private buildCompletionContext(profile: any, draft?: OnboardingData): any {
    const d = draft ?? {};
    const p = profile ?? {};
    const coalesce = (...candidates: unknown[]): unknown => {
      for (const c of candidates) {
        if (c === undefined || c === null) continue;
        if (typeof c === 'string' && c.trim() === '') continue;
        if (Array.isArray(c) && c.length === 0) continue;
        return c;
      }
      return undefined;
    };
    return {
      ...p,
      displayName: coalesce(p.displayName, d.name),
      gender: coalesce(p.gender, d.gender),
      ethnicity: coalesce((p as any).ethnicity, d.ethnicity),
      attractedTo: coalesce(p.attractedTo, d.attractedTo),
      birthDate: coalesce((p as any).birthDate, d.dateOfBirth),
      birthTime: coalesce((p as any).birthTime, d.birthTime),
      birthLocation: coalesce((p as any).birthLocation, d.birthLocation),
      relationshipStyle: coalesce(p.relationshipStyle, d.relationshipStyle),
      longestRomanticRelationship: coalesce(
        p.longestRomanticRelationship,
        (p as any).longest_romantic_relationship,
        d.longestRomanticRelationship,
      ),
      location: coalesce(p.location, d.location),
      occupation: coalesce((p as any).occupation, d.occupation),
      educationLevel: coalesce((p as any).educationLevel, (p as any).education_level, d.educationLevel),
      height: coalesce(p.height, d.height),
      weight: coalesce(p.weight, d.weight),
      height_cm: coalesce((p as any).height_cm, d.height_cm),
      weight_kg: coalesce((p as any).weight_kg, d.weight_kg),
      workout: coalesce(p.workout, d.workout),
      smoking: coalesce(p.smoking, d.smoking),
      drinking: coalesce(p.drinking, d.drinking),
      recreationalDrugsSocial: coalesce(
        (p as any).recreationalDrugsSocial,
        (p as any).recreational_drugs_social,
        d.recreationalDrugsSocial,
      ),
      relationshipWithPsychedelics: coalesce(
        (p as any).relationshipWithPsychedelics,
        (p as any).relationship_with_psychedelics,
        d.relationshipWithPsychedelics,
      ),
      relationshipWithCannabis: coalesce(
        (p as any).relationshipWithCannabis,
        (p as any).relationship_with_cannabis,
        d.relationshipWithCannabis,
      ),
      haveKids: coalesce((p as any).haveKids, d.haveKids),
      wantKids: coalesce((p as any).wantKids, d.wantKids),
      politics: coalesce((p as any).politics, d.politics),
      religion: coalesce((p as any).religion, d.religion),
      sexDrive: coalesce((p as any).sexDrive, (p as any).sex_drive, d.sexDrive),
      sexInterestCategories: coalesce((p as any).sexInterestCategories, d.sexInterestCategories),
      datingPaceAfterExcitement: coalesce(
        (p as any).datingPaceAfterExcitement,
        (p as any).dating_pace_after_excitement,
        d.datingPaceAfterExcitement,
      ),
      recentDatingEarlyWeeks: coalesce(
        (p as any).recentDatingEarlyWeeks,
        (p as any).recent_dating_early_weeks,
        d.recentDatingEarlyWeeks,
      ),
      lifeDomains: coalesce((p as any).lifeDomains, d.lifeDomains),
      typology: coalesce((p as any).typology, d.typology),
      photos: coalesce((p as any).photos, d.photos),
      matchPreferences: coalesce((p as any).matchPreferences, d.matchPreferences),
    };
  }

  /**
   * Same gate as LifeDomainsStep: all five domains numeric and sum exactly 100.
   */
  private lifeDomainsCompletionSatisfied(ctx: any): boolean {
    const ld = (ctx as any)?.lifeDomains;
    if (!ld || typeof ld !== 'object' || Array.isArray(ld)) return false;
    const keys = ['intimacy', 'finance', 'spirituality', 'family', 'physicalHealth'] as const;
    let sum = 0;
    for (const k of keys) {
      const raw = (ld as Record<string, unknown>)[k];
      const n =
        typeof raw === 'number' && Number.isFinite(raw)
          ? raw
          : typeof raw === 'string' && raw.trim() !== ''
            ? Number(raw)
            : NaN;
      if (!Number.isFinite(n)) return false;
      sum += n;
    }
    return sum === 100;
  }

  /**
   * At least one of age / distance range must be stored (mirrors ModalOnboardingFlow profile hydration).
   */
  private matchPreferencesCompletionSatisfied(ctx: any): boolean {
    const mp = (ctx as any)?.matchPreferences;
    if (!mp || typeof mp !== 'object' || Array.isArray(mp)) return false;
    const dr = mp.distanceRange;
    const ar = mp.ageRange;
    const pairOk = (x: unknown) => {
      if (!Array.isArray(x) || x.length !== 2) return false;
      const toN = (v: unknown) =>
        typeof v === 'number' && Number.isFinite(v)
          ? v
          : typeof v === 'string' && v.trim() !== ''
            ? Number(v)
            : NaN;
      return Number.isFinite(toN(x[0])) && Number.isFinite(toN(x[1]));
    };
    return pairOk(dr) || pairOk(ar);
  }

  /**
   * Determine which step the user should be on based on profile data.
   * Mirrors ONBOARDING_STEPS_ORDER in ModalOnboardingFlow (excluding `complete`).
   */
  private determineStepFromProfile(profile: any, savedStep?: string, mergedDraft?: OnboardingData): string {
    const ctx = this.buildCompletionContext(profile, mergedDraft);
    if (savedStep && savedStep !== 'welcome') {
      if (savedStep === 'sexualCompatibility') return 'sexDrive';
      const resumeStep =
        savedStep === 'drugs'
          ? 'haveKids'
          : savedStep === 'sexOpenness' || savedStep === 'sexFrequency'
            ? 'sexInterests'
            : savedStep;
      const tailSteps = [
        'recreationalDrugsSocial',
        'relationshipPsychedelics',
        'relationshipCannabis',
        'haveKids',
        'wantKids',
        'politics',
        'religion',
        'sexDrive',
        'sexInterests',
        'datingPaceAfterExcitement',
        'recentDatingEarlyWeeks',
        'lifeDomains',
        'typology',
        'photos',
        'matchPreferences',
        'complete',
      ] as const;
      const stepsAfterDrinkingNeedSocial = new Set<string>(tailSteps);
      const socialMissing = (() => {
        const v =
          (ctx as any)?.recreationalDrugsSocial ?? (ctx as any)?.recreational_drugs_social;
        return v === undefined || v === null || String(v).trim() === '';
      })();
      if (socialMissing && stepsAfterDrinkingNeedSocial.has(resumeStep)) {
        return 'recreationalDrugsSocial';
      }
      const stepsAfterSocialNeedPsychedelics = new Set<string>(tailSteps.filter((s) => s !== 'recreationalDrugsSocial'));
      const rwpMissing = (() => {
        const v =
          (ctx as any)?.relationshipWithPsychedelics ?? (ctx as any)?.relationship_with_psychedelics;
        return v === undefined || v === null || String(v).trim() === '';
      })();
      if (rwpMissing && stepsAfterSocialNeedPsychedelics.has(resumeStep)) {
        return 'relationshipPsychedelics';
      }
      const stepsAfterPsychedelicsNeedCannabis = new Set<string>(
        tailSteps.filter((s) => s !== 'recreationalDrugsSocial' && s !== 'relationshipPsychedelics'),
      );
      const rwcMissing = (() => {
        const rwc = (ctx as any)?.relationshipWithCannabis ?? (ctx as any)?.relationship_with_cannabis;
        return rwc === undefined || rwc === null || String(rwc).trim() === '';
      })();
      if (rwcMissing && stepsAfterPsychedelicsNeedCannabis.has(resumeStep)) {
        return 'relationshipCannabis';
      }
      return resumeStep;
    }
    if (!ctx?.displayName) return 'name';
    if (!ctx?.gender) return 'gender';
    if (!(ctx as any)?.ethnicity || String((ctx as any).ethnicity).trim() === '') return 'ethnicity';
    if (!ctx?.attractedTo || ctx.attractedTo.length === 0) return 'attraction';
    if (!(ctx as any)?.birthDate) return 'dateOfBirth';
    if (!ctx?.relationshipStyle) return 'relationshipStyle';
    const longest =
      ctx?.longestRomanticRelationship ?? (ctx as any)?.longest_romantic_relationship;
    if (!longest || String(longest).trim() === '') return 'longestRelationship';
    if (!ctx?.location) return 'location';
    if (!(ctx as any)?.occupation) return 'occupation';
    if (!(ctx as any)?.educationLevel && !(ctx as any)?.education_level) return 'educationLevel';
    if (!ctx?.height && !ctx?.weight && (ctx as any).height_cm == null && (ctx as any).weight_kg == null)
      return 'heightWeight';
    if (!ctx?.workout) return 'workout';
    if (!ctx?.smoking) return 'smoking';
    if (!ctx?.drinking) return 'drinking';
    const social = (ctx as any)?.recreationalDrugsSocial ?? (ctx as any)?.recreational_drugs_social;
    if (social === undefined || social === null || String(social).trim() === '')
      return 'recreationalDrugsSocial';
    const rwp =
      (ctx as any)?.relationshipWithPsychedelics ?? (ctx as any)?.relationship_with_psychedelics;
    if (rwp === undefined || rwp === null || String(rwp).trim() === '') return 'relationshipPsychedelics';
    const rwc = (ctx as any)?.relationshipWithCannabis ?? (ctx as any)?.relationship_with_cannabis;
    if (rwc === undefined || rwc === null || String(rwc).trim() === '') return 'relationshipCannabis';
    if ((ctx as any)?.haveKids === undefined || (ctx as any)?.haveKids === null || (ctx as any)?.haveKids === '')
      return 'haveKids';
    if (!normalizeWantKidsToYesNo((ctx as any)?.wantKids)) return 'wantKids';
    if ((ctx as any)?.politics === undefined || (ctx as any)?.politics === null || (ctx as any)?.politics === '')
      return 'politics';
    if ((ctx as any)?.religion === undefined || (ctx as any)?.religion === null || (ctx as any)?.religion === '')
      return 'religion';
    if (!String((ctx as any)?.sexDrive ?? (ctx as any)?.sex_drive ?? '').trim()) return 'sexDrive';
    const sexInterest = (ctx as any)?.sexInterestCategories;
    if (!Array.isArray(sexInterest) || sexInterest.length === 0) return 'sexInterests';
    if (
      !String(
        (ctx as any)?.datingPaceAfterExcitement ?? (ctx as any)?.dating_pace_after_excitement ?? '',
      ).trim()
    )
      return 'datingPaceAfterExcitement';
    if (!String((ctx as any)?.recentDatingEarlyWeeks ?? (ctx as any)?.recent_dating_early_weeks ?? '').trim())
      return 'recentDatingEarlyWeeks';
    if (!this.lifeDomainsCompletionSatisfied(ctx)) return 'lifeDomains';
    if (!(ctx as any)?.photos || !Array.isArray((ctx as any).photos) || (ctx as any).photos.length === 0)
      return 'photos';
    if (!this.matchPreferencesCompletionSatisfied(ctx)) return 'matchPreferences';
    return 'complete';
  }

  /**
   * Map profile data to onboarding data format
   */
  private mapProfileToOnboardingData(profile: any): OnboardingData {
    const rawPrefs =
      profile?.matchPreferences && typeof profile.matchPreferences === 'object'
        ? { ...profile.matchPreferences }
        : {};
    const { relationshipType: _relDrop, ...rawPrefsNoRel } = rawPrefs as Record<string, unknown> & {
      relationshipType?: unknown;
    };
    const mergedPrefs = {
      ...rawPrefsNoRel,
      childrenPreference:
        (rawPrefs as any).childrenPreference ??
        (profile as any)?.prefChildren ??
        (profile as any)?.pref_children,
      ageRange:
        Array.isArray((rawPrefs as any).ageRange) && (rawPrefs as any).ageRange.length === 2
          ? (rawPrefs as any).ageRange
          : (profile as any)?.prefAgeMin != null && (profile as any)?.prefAgeMax != null
            ? [(profile as any).prefAgeMin, (profile as any).prefAgeMax]
            : (profile as any)?.pref_age_min != null && (profile as any)?.pref_age_max != null
              ? [(profile as any).pref_age_min, (profile as any).pref_age_max]
              : undefined,
      politicsPreference:
        (rawPrefs as any).politicsPreference ??
        (profile as any)?.prefPolitics ??
        (profile as any)?.pref_politics,
      religionPreference:
        (rawPrefs as any).religionPreference ??
        (profile as any)?.prefReligion ??
        (profile as any)?.pref_religion,
      smokingPreference:
        (rawPrefs as any).smokingPreference ??
        (profile as any)?.prefSmokes ??
        (profile as any)?.pref_smokes,
      drinkingPreference:
        (rawPrefs as any).drinkingPreference ??
        (profile as any)?.prefDrinks ??
        (profile as any)?.pref_drinks,
      cannabisPreference:
        (rawPrefs as any).cannabisPreference ??
        (profile as any)?.prefDrugs ??
        (profile as any)?.pref_drugs,
    };

    return {
      name: profile?.displayName,
      dateOfBirth: (profile as any)?.birthDate,
      birthTime: (profile as any)?.birthTime,
      birthLocation: (profile as any)?.birthLocation,
      height: profile?.height != null ? String(profile.height) : undefined,
      weight: profile?.weight != null ? String(profile.weight) : undefined,
      gender: profile?.gender ? mapGenderToUi(profile.gender) : undefined,
      ethnicity: (profile as any)?.ethnicity ? String((profile as any).ethnicity) : undefined,
      attractedTo: profile?.attractedTo,
      relationshipStyle: profile?.relationshipStyle,
      longestRomanticRelationship:
        profile?.longestRomanticRelationship ?? (profile as any)?.longest_romantic_relationship
          ? String(profile?.longestRomanticRelationship ?? (profile as any)?.longest_romantic_relationship)
          : undefined,
      location: profile?.location,
      occupation: (profile as any)?.occupation,
      educationLevel: (profile as any)?.educationLevel ?? (profile as any)?.education_level,
      typology: {
        loveLanguage: (profile as any)?.questionAnswers?.loveLanguage,
        myersBriggs:
          (profile as any)?.questionAnswers?.myersBriggs ??
          (profile as any)?.myersBriggs,
        enneagramType: (profile as any)?.questionAnswers?.enneagramType,
        enneagramWing: (profile as any)?.questionAnswers?.enneagramWing,
        enneagramInstinct: (profile as any)?.questionAnswers?.enneagramInstinct,
        sunSign:
          (profile as any)?.questionAnswers?.sunSign ??
          (profile as any)?.astrology?.sunSign,
        risingSign: (profile as any)?.questionAnswers?.risingSign,
        moonSign:
          (profile as any)?.questionAnswers?.moonSign ??
          (profile as any)?.astrology?.moonSign,
        venusSign:
          (profile as any)?.questionAnswers?.venusSign ??
          (profile as any)?.astrology?.venusSign,
        marsSign:
          (profile as any)?.questionAnswers?.marsSign ??
          (profile as any)?.astrology?.marsSign,
        saturnSign:
          (profile as any)?.questionAnswers?.saturnSign ??
          (profile as any)?.astrology?.saturnSign,
        humanDesignType: (profile as any)?.questionAnswers?.humanDesignType,
        humanDesignProfile: (profile as any)?.questionAnswers?.humanDesignProfile,
        humanDesignAuthority: (profile as any)?.questionAnswers?.humanDesignAuthority,
        eroticBlueprintType: (profile as any)?.questionAnswers?.eroticBlueprintType,
        spiralDynamics: (profile as any)?.questionAnswers?.spiralDynamics
          ? String((profile as any).questionAnswers.spiralDynamics)
          : undefined,
      },
      workout: profile?.workout,
      smoking: profile?.smoking,
      drinking: profile?.drinking,
      recreationalDrugsSocial: (() => {
        const v =
          (profile as any)?.recreationalDrugsSocial ?? (profile as any)?.recreational_drugs_social;
        const s = String(v ?? '').trim();
        return s || undefined;
      })(),
      relationshipWithPsychedelics: (() => {
        const v =
          (profile as any)?.relationshipWithPsychedelics ??
          (profile as any)?.relationship_with_psychedelics;
        const s = String(v ?? '').trim();
        return s || undefined;
      })(),
      relationshipWithCannabis: (() => {
        const v =
          (profile as any)?.relationshipWithCannabis ?? (profile as any)?.relationship_with_cannabis;
        const s = String(v ?? '').trim();
        return s || undefined;
      })(),
      haveKids: (profile as any)?.haveKids,
      wantKids: normalizeWantKidsToYesNo((profile as any)?.wantKids) || undefined,
      politics: (profile as any)?.politics,
      religion: (profile as any)?.religion,
      prefPhysicalCompatImportance: (profile as any)?.prefPhysicalCompatImportance,
      prefPartnerSharesSexualInterests: (profile as any)?.prefPartnerSharesSexualInterests,
      sexDrive: (profile as any)?.sexDrive ?? (profile as any)?.sex_drive,
      sexInterestCategories: Array.isArray((profile as any)?.sexInterestCategories)
        ? [...(profile as any).sexInterestCategories]
        : undefined,
      datingPaceAfterExcitement:
        (profile as any)?.datingPaceAfterExcitement ?? (profile as any)?.dating_pace_after_excitement,
      recentDatingEarlyWeeks:
        (profile as any)?.recentDatingEarlyWeeks ?? (profile as any)?.recent_dating_early_weeks,
      prefPartnerHasChildren: (profile as any)?.prefPartnerHasChildren,
      prefPartnerPoliticalAlignmentImportance: (() => {
        const raw = String((profile as any)?.prefPartnerPoliticalAlignmentImportance ?? "").trim();
        const n = normalizePartnerPoliticalAlignmentToYesNo(raw);
        return n || undefined;
      })(),
      hobbies: profile?.hobbies,
      professionalHobbyId: (profile as any)?.professionalHobbyId,
      availability: profile?.availability,
      contactPreference: profile?.contactPreference,
      phoneNumber: profile?.phoneNumber,
      photos: profile?.photos,
      bio: profile?.bio,
      lifeDomains: profile?.lifeDomains,
      matchPreferences: mergedPrefs as any,
    };
  }

  /**
   * Get saved onboarding progress for a user, merging with profile data
   */
  async getProgress(userId: string): Promise<Result<OnboardingProgress>> {
    try {
      // Get profile data to determine current step and pre-fill inputs
      const profileResult = await profilesRepo.getProfile(userId);
      const profile = profileResult.success ? profileResult.data : null;

      // Get saved onboarding progress
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { success: false, error: error as Error };
      }

      // Map profile data to onboarding data format (used only as fallback defaults)
      const profileOnboardingData = profile ? this.mapProfileToOnboardingData(profile) : {};

      // Saved onboarding_data from progress table (authoritative source for answers)
      const savedOnboardingData: OnboardingData = (data?.onboarding_data as OnboardingData) || {};

      // Merge so that SAVED onboarding responses always take precedence over profile.
      // Profile data is only used to prefill when there is no saved value yet.
      const mergedOnboardingData: OnboardingData = {
        ...profileOnboardingData,
        ...savedOnboardingData,
      };
      const wantKidsNorm = normalizeWantKidsToYesNo(mergedOnboardingData.wantKids);
      if (wantKidsNorm) mergedOnboardingData.wantKids = wantKidsNorm;
      else delete mergedOnboardingData.wantKids;

      const polNorm = normalizePartnerPoliticalAlignmentToYesNo(
        String(mergedOnboardingData.prefPartnerPoliticalAlignmentImportance ?? "")
      );
      if (polNorm) mergedOnboardingData.prefPartnerPoliticalAlignmentImportance = polNorm;
      else delete mergedOnboardingData.prefPartnerPoliticalAlignmentImportance;

      // Determine resume step from merged profile+draft state only.
      // `current_step` can be stale; recomputing prevents users from being sent backward.
      const currentStep = this.determineStepFromProfile(profile, undefined, mergedOnboardingData);

      // #region agent log
      (() => {
        const ctx = this.buildCompletionContext(profile, mergedOnboardingData);
        const typ = (mergedOnboardingData as any)?.typology;
        const typFilledKeys =
          typ && typeof typ === 'object'
            ? Object.keys(typ).filter((k) => {
                const v = (typ as Record<string, unknown>)[k];
                return v != null && String(v).trim() !== '';
              }).length
            : 0;
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            runId: 'investigate-1',
            hypothesisId: 'H_B,H_D,H_merge',
            location: 'datingProfile/modalOnboardingService.ts:getProgress',
            message: 'resume step computed',
            data: {
              currentStep,
              dbCurrentStep: data?.current_step ?? null,
              savedDraftKeyCount: Object.keys(savedOnboardingData).length,
              mergedKeyCount: Object.keys(mergedOnboardingData).length,
              gate: {
                hasDisplayName: !!ctx?.displayName,
                hasGender: !!ctx?.gender,
                hasEthnicity: !!String((ctx as any)?.ethnicity ?? '').trim(),
                hasLifeDomains: !!(ctx as any)?.lifeDomains,
                typologyFilledKeys: typFilledKeys,
                hasPhotos: Array.isArray((ctx as any)?.photos) && (ctx as any).photos.length > 0,
                hasMatchPrefs: !!(ctx as any)?.matchPreferences,
              },
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      })();
      // #endregion

      return {
        success: true,
        data: {
          currentStep,
          completedSteps: data?.completed_steps || [],
          onboardingData: mergedOnboardingData,
        },
      };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Save onboarding progress
   */
  async saveProgress(
    userId: string,
    progress: { currentStep: string; onboardingData: OnboardingData }
  ): Promise<Result<void>> {
    try {
      // Filter out empty values for completed steps tracking
      const completedSteps = Object.keys(progress.onboardingData).filter(
        key => {
          const value = progress.onboardingData[key as keyof OnboardingData];
          if (value === undefined || value === null || value === '') return false;
          // For arrays, check if they have items
          if (Array.isArray(value)) return value.length > 0;
          return true;
        }
      );

      const updateData = {
        current_step: progress.currentStep,
        completed_steps: completedSteps,
        onboarding_data: progress.onboardingData,
      };

      console.log('Saving onboarding progress:', {
        userId,
        currentStep: progress.currentStep,
        completedSteps,
        onboardingDataKeys: Object.keys(progress.onboardingData),
        onboardingDataValues: Object.entries(progress.onboardingData).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              acc[key] = `Array(${value.length})`;
            } else if (typeof value === 'object') {
              acc[key] = `Object(${Object.keys(value).length} keys)`;
            } else {
              acc[key] = String(value).substring(0, 50);
            }
          }
          return acc;
        }, {} as Record<string, string>),
      });

      // First, try to update existing record
      const { data: existingData, error: selectError } = await supabase
        .from('onboarding_progress')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (selectError) {
        console.error('Error checking existing progress:', selectError);
        return { success: false, error: selectError as Error };
      }

      if (existingData) {
        // Update existing record
        const { error: updateError, data: updatedData } = await supabase
          .from('onboarding_progress')
          .update(updateData)
          .eq('user_id', userId)
          .select();

        if (updateError) {
          console.error('Supabase error updating progress:', updateError);
          return { success: false, error: updateError as Error };
        }
        
        console.log('Successfully updated onboarding progress in database:', {
          userId,
          currentStep: progress.currentStep,
          completedStepsCount: completedSteps.length,
          dataKeys: Object.keys(progress.onboardingData),
        });
      } else {
        // Insert new record
        const { error: insertError, data: insertedData } = await supabase
          .from('onboarding_progress')
          .insert({
            user_id: userId,
            ...updateData,
          })
          .select();

        if (insertError) {
          console.error('Supabase error inserting progress:', insertError);
          return { success: false, error: insertError as Error };
        }
        
        console.log('Successfully inserted onboarding progress in database:', {
          userId,
          currentStep: progress.currentStep,
          completedStepsCount: completedSteps.length,
          dataKeys: Object.keys(progress.onboardingData),
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Exception saving progress:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Complete onboarding and save all data to profile
   */
  async completeOnboarding(userId: string, data: OnboardingData): Promise<Result<void>> {
    try {
      const existingProfileResult = await profilesRepo.getProfile(userId);
      const existingProfile =
        existingProfileResult.success && existingProfileResult.data
          ? existingProfileResult.data
          : null;

      // Map onboarding data to profile fields
      const profileUpdates: any = {};

      if (data.name) profileUpdates.displayName = data.name;
      if (data.dateOfBirth) profileUpdates.birthDate = data.dateOfBirth;
      if (data.birthTime !== undefined && String(data.birthTime).trim() !== '') {
        profileUpdates.birthTime = String(data.birthTime).trim();
      }
      if (data.birthLocation !== undefined && String(data.birthLocation).trim() !== '') {
        profileUpdates.birthLocation = String(data.birthLocation).trim();
      }
      if (data.gender) {
        const { mapGenderToDb } = await import('@/shared/utils/genderMapper');
        const mappedGender = mapGenderToDb(data.gender);
        if (mappedGender) {
          profileUpdates.gender = mappedGender;
        }
      }
      if (data.ethnicity && String(data.ethnicity).trim() !== '') {
        (profileUpdates as any).ethnicity = String(data.ethnicity).trim();
      }
      if (data.attractedTo && data.attractedTo.length > 0) {
        profileUpdates.attractedTo = data.attractedTo;
        // Also save to looking_for column
        (profileUpdates as any).lookingFor = data.attractedTo;
      }
      if (data.relationshipStyle) {
        profileUpdates.relationshipStyle = mapRelationshipStyleUiToDb(data.relationshipStyle) as any;
        (profileUpdates as any).relationshipType = mapRelationshipStyleUiToRelationshipType(
          data.relationshipStyle
        );
      }
      if (data.longestRomanticRelationship !== undefined && String(data.longestRomanticRelationship).trim() !== '') {
        (profileUpdates as any).longestRomanticRelationship = String(data.longestRomanticRelationship).trim();
      }
      if (data.location) profileUpdates.location = data.location;
      if (data.occupation) (profileUpdates as any).occupation = data.occupation;
      if (data.educationLevel) (profileUpdates as any).educationLevel = data.educationLevel;
      if (data.typology) {
        const existingAnswers =
          existingProfile &&
          (existingProfile as any).questionAnswers &&
          typeof (existingProfile as any).questionAnswers === 'object'
            ? { ...(existingProfile as any).questionAnswers }
            : {};

        const nextAnswers = {
          ...existingAnswers,
          loveLanguage: data.typology.loveLanguage || undefined,
          myersBriggs: data.typology.myersBriggs || undefined,
          enneagramType: data.typology.enneagramType || undefined,
          enneagramWing: data.typology.enneagramWing || undefined,
          enneagramInstinct: data.typology.enneagramInstinct || undefined,
          sunSign: data.typology.sunSign || undefined,
          risingSign: data.typology.risingSign || undefined,
          moonSign: data.typology.moonSign || undefined,
          venusSign: data.typology.venusSign || undefined,
          marsSign: data.typology.marsSign || undefined,
          saturnSign: data.typology.saturnSign || undefined,
          humanDesignType: data.typology.humanDesignType || undefined,
          humanDesignProfile: data.typology.humanDesignProfile || undefined,
          humanDesignAuthority: data.typology.humanDesignAuthority || undefined,
          eroticBlueprintType: data.typology.eroticBlueprintType || undefined,
          spiralDynamics: data.typology.spiralDynamics || undefined,
        };

        (profileUpdates as any).questionAnswers = nextAnswers;
        if (data.typology.myersBriggs) {
          (profileUpdates as any).myersBriggs = data.typology.myersBriggs;
        }
      }
      const hw = buildHeightWeightProfileFields({
        height: data.height,
        height_cm: data.height_cm,
        weight: data.weight,
        weight_kg: data.weight_kg,
      });
      if (hw.height) (profileUpdates as any).height = hw.height;
      if (hw.heightLabel) (profileUpdates as any).heightLabel = hw.heightLabel;
      if (hw.weight) (profileUpdates as any).weight = hw.weight;
      if (hw.weightLabel) (profileUpdates as any).weightLabel = hw.weightLabel;
      if (data.workout) (profileUpdates as any).workout = data.workout;
      if (data.smoking) (profileUpdates as any).smoking = data.smoking;
      if (data.drinking) (profileUpdates as any).drinking = data.drinking;
      if (
        data.recreationalDrugsSocial !== undefined &&
        String(data.recreationalDrugsSocial).trim() !== ''
      ) {
        (profileUpdates as any).recreationalDrugsSocial = String(data.recreationalDrugsSocial).trim();
      }
      if (
        data.relationshipWithPsychedelics !== undefined &&
        String(data.relationshipWithPsychedelics).trim() !== ''
      ) {
        (profileUpdates as any).relationshipWithPsychedelics = String(
          data.relationshipWithPsychedelics
        ).trim();
      }
      if (data.relationshipWithCannabis !== undefined && String(data.relationshipWithCannabis).trim() !== '') {
        (profileUpdates as any).relationshipWithCannabis = String(data.relationshipWithCannabis).trim();
      }
      if (data.haveKids !== undefined) (profileUpdates as any).haveKids = data.haveKids;
      if (data.wantKids !== undefined) (profileUpdates as any).wantKids = data.wantKids;
      if (data.politics !== undefined) (profileUpdates as any).politics = data.politics;
      if (data.religion !== undefined) (profileUpdates as any).religion = data.religion;
      if (data.prefPhysicalCompatImportance !== undefined)
        (profileUpdates as any).prefPhysicalCompatImportance = data.prefPhysicalCompatImportance;
      if (data.prefPartnerSharesSexualInterests !== undefined)
        (profileUpdates as any).prefPartnerSharesSexualInterests = data.prefPartnerSharesSexualInterests;
      if (data.sexDrive !== undefined) (profileUpdates as any).sexDrive = data.sexDrive;
      if (data.sexInterestCategories !== undefined)
        (profileUpdates as any).sexInterestCategories = data.sexInterestCategories;
      if (data.datingPaceAfterExcitement !== undefined)
        (profileUpdates as any).datingPaceAfterExcitement = data.datingPaceAfterExcitement;
      if (data.recentDatingEarlyWeeks !== undefined)
        (profileUpdates as any).recentDatingEarlyWeeks = data.recentDatingEarlyWeeks;
      if (data.prefPartnerHasChildren !== undefined)
        (profileUpdates as any).prefPartnerHasChildren = data.prefPartnerHasChildren;
      if (data.prefPartnerPoliticalAlignmentImportance !== undefined)
        (profileUpdates as any).prefPartnerPoliticalAlignmentImportance =
          data.prefPartnerPoliticalAlignmentImportance;
      if (data.hobbies !== undefined) profileUpdates.hobbies = data.hobbies;
      if (data.professionalHobbyId !== undefined) (profileUpdates as any).professionalHobbyId = data.professionalHobbyId;
      if (data.availability && data.availability.length > 0) {
        profileUpdates.availability = data.availability;
      }
      if (data.contactPreference) profileUpdates.contactPreference = data.contactPreference;
      if (data.phoneNumber) profileUpdates.phoneNumber = data.phoneNumber;
      if (data.photos && data.photos.length > 0) {
        profileUpdates.photos = data.photos;
      }
      if (data.bio) profileUpdates.bio = data.bio;
      if (data.lifeDomains) {
        profileUpdates.lifeDomains = data.lifeDomains;
      }
      if (data.matchPreferences) {
        const prefs = data.matchPreferences as Record<string, unknown>;
        const { relationshipType: _ignore, ...prefsClean } = prefs;
        profileUpdates.matchPreferences = prefsClean;
        if (Array.isArray(prefs.ageRange) && prefs.ageRange.length === 2) {
          const [minAge, maxAge] = prefs.ageRange;
          if (Number.isFinite(minAge)) (profileUpdates as any).prefAgeMin = minAge;
          if (Number.isFinite(maxAge)) (profileUpdates as any).prefAgeMax = maxAge;
        }
        if (prefs.childrenPreference !== undefined) (profileUpdates as any).prefChildren = prefs.childrenPreference;
        if (prefs.politicsPreference !== undefined) (profileUpdates as any).prefPolitics = prefs.politicsPreference;
        if (prefs.religionPreference !== undefined) (profileUpdates as any).prefReligion = prefs.religionPreference;
        if (
          prefs.partnerAlignmentTobacco !== undefined &&
          String(prefs.partnerAlignmentTobacco).trim() !== ''
        ) {
          (profileUpdates as any).prefSmokes = prefs.partnerAlignmentTobacco;
        } else if (prefs.smokingPreference !== undefined) {
          (profileUpdates as any).prefSmokes = prefs.smokingPreference;
        }
        if (
          prefs.partnerAlignmentAlcohol !== undefined &&
          String(prefs.partnerAlignmentAlcohol).trim() !== ''
        ) {
          (profileUpdates as any).prefDrinks = prefs.partnerAlignmentAlcohol;
        } else if (prefs.drinkingPreference !== undefined) {
          (profileUpdates as any).prefDrinks = prefs.drinkingPreference;
        }
        if (
          prefs.partnerAlignmentCannabis !== undefined &&
          String(prefs.partnerAlignmentCannabis).trim() !== ''
        ) {
          (profileUpdates as any).prefDrugs = prefs.partnerAlignmentCannabis;
        } else if (prefs.cannabisPreference !== undefined) {
          (profileUpdates as any).prefDrugs = prefs.cannabisPreference;
        }
      }

      console.log('Completing onboarding with data:', {
        hasName: !!data.name,
        nameValue: data.name,
        hasGender: !!data.gender,
        hasRelationshipStyle: !!data.relationshipStyle,
        hasLocation: !!data.location,
        hasLifeDomains: !!data.lifeDomains,
        hasMatchPreferences: !!data.matchPreferences,
        profileUpdates: Object.keys(profileUpdates),
        profileUpdatesValues: {
          displayName: profileUpdates.displayName,
          gender: profileUpdates.gender,
        },
      });

      // Mark onboarding as seen - this prevents onboarding modals from being shown again
      profileUpdates.hasSeenOnboardingIntro = true;
      // User is not fully onboarding-complete until required assessments are finished.
      profileUpdates.assessmentsStarted = false;
      profileUpdates.assessmentsCompleted = false;
      profileUpdates.assessmentsCompletedAt = null;
      profileUpdates.onboardingCompleted = false;
      profileUpdates.onboardingCompletedAt = null;

      // Update profile
      const updateResult = await profilesRepo.updateProfile(userId, profileUpdates);
      if (!updateResult.success) {
        console.error('Failed to update profile during onboarding completion:', updateResult.error);
        return updateResult;
      }

      if (data.lifeDomains && !Array.isArray(data.lifeDomains)) {
        const domains = data.lifeDomains as {
          intimacy?: number;
          finance?: number;
          spirituality?: number;
          family?: number;
          physicalHealth?: number;
        };
        const mappedSettings: Array<{ domain_id: string; importance: number }> = [
          { domain_id: 'intimacy', importance: Number(domains.intimacy ?? 0) },
          { domain_id: 'finance', importance: Number(domains.finance ?? 0) },
          { domain_id: 'spirituality', importance: Number(domains.spirituality ?? 0) },
          { domain_id: 'family', importance: Number(domains.family ?? 0) },
          // Onboarding key is physicalHealth; edit-profile key/table uses health.
          { domain_id: 'health', importance: Number(domains.physicalHealth ?? 0) },
        ].map((row) => ({
          domain_id: row.domain_id,
          importance: Math.max(0, Math.min(100, Math.round(row.importance))),
        }));

        const { error: settingsError } = await supabase.from('life_domain_settings').upsert(
          mappedSettings.map((row) => ({
            user_id: userId,
            domain_id: row.domain_id,
            importance: row.importance,
          })),
          { onConflict: 'user_id,domain_id' }
        );

        if (settingsError) {
          console.error('Failed to upsert life_domain_settings during onboarding completion:', settingsError);
        }
      }

      console.log('Profile updated successfully during onboarding completion');

      // Mark onboarding as complete by deleting progress record
      const { error } = await supabase
        .from('onboarding_progress')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting onboarding progress:', error);
        // Don't fail if deletion fails
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Check if user has completed modal-based onboarding
   */
  async isComplete(userId: string): Promise<Result<boolean>> {
    try {
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { success: false, error: error as Error };
      }

      // If no record exists, onboarding is complete
      return { success: true, data: !data };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}

export const modalOnboardingService = new ModalOnboardingService();

