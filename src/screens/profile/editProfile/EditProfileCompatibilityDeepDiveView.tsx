import React, { useCallback, useMemo, useRef, useState } from 'react';

import {

  View,

  Text,

  StyleSheet,

  PanResponder,

  Pressable,

  type LayoutChangeEvent,

} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {

  countAnsweredInDomain,

  getLifeDomainOnboardingMeta,

  type LifeDomainId,

} from '@/shared/constants/lifeDomainOnboardingQuestions';

import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';

import { DOMAIN_ID_TO_ONBOARDING_KEY } from '@/screens/profile/editProfile/editProfileDomainKeys';

import {

  ONBOARDING_LIFE_DOMAIN_KEYS,

  type OnboardingLifeDomainKey,

  type OnboardingLifeDomainValues,

} from '@/shared/components/LifeDomainDistribution';

import {

  EditProfileFieldCard,

  EditProfileSection,

} from '@/screens/profile/editProfile/EditProfileUi';

import { EditProfileLifeDomainQuestionsModal } from '@/screens/profile/editProfile/EditProfileLifeDomainQuestionsModal';

import { ep } from '@/screens/profile/editProfile/editProfileTheme';

import {

  ONBOARDING_LIFE_DOMAINS_DESCRIPTION,

} from '@/datingProfile/screens/onboarding/modals/onboardingStepCopy';

import { getLifeDomainAnswersForDomain } from '@/screens/profile/editProfile/editProfileLifeDomainQuestionFields';



const COMPATIBILITY_DOMAIN_ORDER: LifeDomainId[] = [

  'intimacy',

  'finance',

  'spirituality',

  'family',

  'health',

];



const THUMB_SIZE = 20;

const SLIDER_ROW_HEIGHT = 40;



function clampDomainValue(

  key: OnboardingLifeDomainKey,

  next: number,

  current: OnboardingLifeDomainValues,

): number {

  const rounded = Math.max(0, Math.min(100, Math.round(next)));

  const total = ONBOARDING_LIFE_DOMAIN_KEYS.reduce((s, k) => s + (current[k] ?? 0), 0);

  const others = total - (current[key] ?? 0);

  const maxForKey = Math.min(100, Math.max(0, 100 - others));

  return Math.max(0, Math.min(maxForKey, rounded));

}



function DomainImportanceSlider({

  domainKey,

  value,

  values,

  onValuesChange,

}: {

  domainKey: OnboardingLifeDomainKey;

  value: number;

  values: OnboardingLifeDomainValues;

  onValuesChange: (next: OnboardingLifeDomainValues) => void;

}) {

  const trackWidthRef = useRef(1);



  const setFromLocalX = useCallback(

    (localX: number) => {

      const w = trackWidthRef.current;

      if (w <= 0) return;

      const ratio = Math.max(0, Math.min(1, localX / w));

      const desired = ratio * 100;

      const clamped = clampDomainValue(domainKey, desired, values);

      if (clamped !== values[domainKey]) {

        onValuesChange({ ...values, [domainKey]: clamped });

      }

    },

    [domainKey, onValuesChange, values],

  );



  const pan = useMemo(

    () =>

      PanResponder.create({

        onStartShouldSetPanResponder: () => true,

        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (e) => setFromLocalX(e.nativeEvent.locationX),

        onPanResponderMove: (e) => setFromLocalX(e.nativeEvent.locationX),

      }),

    [setFromLocalX],

  );



  const thumbTop = (SLIDER_ROW_HEIGHT - THUMB_SIZE) / 2;

  const pct = Math.min(100, Math.max(0, value));



  return (

    <View style={sliderStyles.wrap}>

      <View style={sliderStyles.labelRow}>

        <Text style={sliderStyles.label}>Importance</Text>

        <Text style={sliderStyles.value}>{value}</Text>

      </View>

      <View

        style={sliderStyles.touch}

        onLayout={(e: LayoutChangeEvent) => {

          trackWidthRef.current = e.nativeEvent.layout.width;

        }}

        {...pan.panHandlers}

      >

        <View style={sliderStyles.track}>

          <View style={[sliderStyles.fill, { width: `${pct}%` }]} />

        </View>

        <View

          pointerEvents="none"

          style={[

            sliderStyles.thumb,

            { left: `${pct}%`, marginLeft: -THUMB_SIZE / 2, top: thumbTop },

          ]}

        />

      </View>

    </View>

  );

}



function EditProfileDomainCard({

  domainId,

  wantKids,

  lifeDomainsState,

  onLifeDomainsChange,

  answers,

  onOpenQuestions,

}: {

  domainId: LifeDomainId;

  wantKids?: string | null;

  lifeDomainsState: OnboardingLifeDomainValues;

  onLifeDomainsChange: (next: OnboardingLifeDomainValues) => void;

  answers: LifeDomainAnswersMap;

  onOpenQuestions: (domainId: LifeDomainId) => void;

}) {

  const meta = getLifeDomainOnboardingMeta(domainId);

  const domainKey = DOMAIN_ID_TO_ONBOARDING_KEY[domainId];

  const domainAnswers = getLifeDomainAnswersForDomain(answers, domainId);

  const { answered, total } = useMemo(

    () => countAnsweredInDomain(domainId, domainAnswers, { wantKids }),

    [domainAnswers, domainId, wantKids],

  );



  return (

    <EditProfileFieldCard style={domainStyles.card}>

      <Pressable

        onPress={() => onOpenQuestions(domainId)}

        style={({ pressed }) => [domainStyles.domainPressable, pressed && domainStyles.domainPressed]}

        accessibilityRole="button"

        accessibilityLabel={`Open ${meta.name} questions`}

      >

        <View style={domainStyles.domainHeader}>

          <View style={domainStyles.domainHeaderText}>

            <Text style={domainStyles.domainName}>{meta.name}</Text>

            {total > 0 ? (

              <Text style={domainStyles.domainMeta}>

                {answered} of {total} answered

              </Text>

            ) : null}

          </View>

          <Ionicons name="chevron-forward" size={18} color={ep.colors.textDim} />

        </View>

      </Pressable>

      <DomainImportanceSlider

        domainKey={domainKey}

        value={lifeDomainsState[domainKey] ?? 0}

        values={lifeDomainsState}

        onValuesChange={onLifeDomainsChange}

      />

    </EditProfileFieldCard>

  );

}



export function countCompatibilityDomainsStarted(

  lifeDomainsState: OnboardingLifeDomainValues,

  answers: LifeDomainAnswersMap,

  wantKids?: string | null,

): { started: number; total: number } {

  let started = 0;

  for (const domainId of COMPATIBILITY_DOMAIN_ORDER) {

    const key = DOMAIN_ID_TO_ONBOARDING_KEY[domainId];

    const slider = lifeDomainsState[key] ?? 0;

    const domainAnswers = answers[domainId] ?? {};

    const hasAnswer = Object.values(domainAnswers).some(

      (v) => v != null && String(v).trim() !== '',

    );

    if (slider > 0 || hasAnswer) started += 1;

  }

  return { started, total: COMPATIBILITY_DOMAIN_ORDER.length };

}



export function EditProfileCompatibilityDeepDiveView({

  wantKids,

  lifeDomainsState,

  onLifeDomainsChange,

  lifeDomainAnswers,

  onLifeDomainAnswerChange,

  lifeDomainsTotal,

  lifeDomainsSumOk,

  openQuestionsDomainId,

  onOpenQuestionsDomainIdChange,

  userId,

}: {

  wantKids?: string | null;

  lifeDomainsState: OnboardingLifeDomainValues;

  onLifeDomainsChange: (next: OnboardingLifeDomainValues) => void;

  lifeDomainAnswers: LifeDomainAnswersMap;

  onLifeDomainAnswerChange: (

    domainId: LifeDomainId,

    questionId: string,

    value: string,

  ) => void;

  lifeDomainsTotal: number;

  lifeDomainsSumOk: boolean;

  openQuestionsDomainId?: LifeDomainId | null;

  onOpenQuestionsDomainIdChange?: (domainId: LifeDomainId | null) => void;

  userId: string;

}) {

  const [internalOpenQuestionsDomainId, setInternalOpenQuestionsDomainId] =
    useState<LifeDomainId | null>(null);

  const questionsDomainId =
    openQuestionsDomainId !== undefined
      ? openQuestionsDomainId
      : internalOpenQuestionsDomainId;

  const setQuestionsDomainId =
    onOpenQuestionsDomainIdChange ?? setInternalOpenQuestionsDomainId;



  return (

    <View>

      <EditProfileSection

        first

        title="Life domains"

        description={ONBOARDING_LIFE_DOMAINS_DESCRIPTION}

      >

      <Text style={domainStyles.totalHint}>

        Domain importance must total 100 (currently {lifeDomainsTotal}).

      </Text>

      {!lifeDomainsSumOk ? (

        <Text style={domainStyles.totalError}>

          Adjust sliders so all five domains sum to 100 before saving.

        </Text>

      ) : null}

      {COMPATIBILITY_DOMAIN_ORDER.map((domainId) => (

        <EditProfileDomainCard

          key={domainId}

          domainId={domainId}

          wantKids={wantKids}

          lifeDomainsState={lifeDomainsState}

          onLifeDomainsChange={onLifeDomainsChange}

          answers={lifeDomainAnswers}

          onOpenQuestions={setQuestionsDomainId}

        />

      ))}

      </EditProfileSection>

      {questionsDomainId ? (

        <EditProfileLifeDomainQuestionsModal

          visible

          userId={userId}

          domainId={questionsDomainId}

          wantKids={wantKids}

          answers={lifeDomainAnswers}

          onAnswerChange={onLifeDomainAnswerChange}

          onClose={() => setQuestionsDomainId(null)}

        />

      ) : null}

    </View>

  );

}



const sliderStyles = StyleSheet.create({

  wrap: { marginTop: 12, marginBottom: 4 },

  labelRow: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    marginBottom: 8,

  },

  label: {

    fontFamily: ep.fonts.body,

    fontSize: 12,

    color: ep.colors.textSecondary,

  },

  value: {

    fontFamily: ep.fonts.ui,

    fontSize: 13,

    fontWeight: '600',

    color: ep.colors.flameMid,

  },

  touch: {

    height: SLIDER_ROW_HEIGHT,

    justifyContent: 'center',

  },

  track: {

    height: 8,

    borderRadius: 999,

    backgroundColor: ep.colors.borderDefault,

    overflow: 'hidden',

  },

  fill: {

    height: '100%',

    borderRadius: 999,

    backgroundColor: ep.colors.flameMid,

  },

  thumb: {

    position: 'absolute',

    width: THUMB_SIZE,

    height: THUMB_SIZE,

    borderRadius: THUMB_SIZE / 2,

    backgroundColor: ep.colors.flameMid,

    borderWidth: 2,

    borderColor: ep.colors.textOnPrimary,

  },

});



const domainStyles = StyleSheet.create({

  card: { marginBottom: 14 },

  domainPressable: {

    marginBottom: 4,

    borderRadius: 8,

  },

  domainPressed: {

    opacity: 0.82,

  },

  domainHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    gap: 12,

  },

  domainHeaderText: {

    flex: 1,

    gap: 4,

  },

  domainName: {

    fontFamily: ep.fonts.display,

    fontSize: 20,

    fontWeight: '500',

    color: ep.colors.textBright,

  },

  domainMeta: {

    fontFamily: ep.fonts.body,

    fontSize: 13,

    color: ep.colors.textSecondary,

  },

  totalHint: {

    fontFamily: ep.fonts.body,

    fontSize: 13,

    color: ep.colors.textSecondary,

    marginBottom: 8,

  },

  totalError: {

    fontFamily: ep.fonts.body,

    fontSize: 13,

    color: ep.colors.errorSoft,

    marginBottom: 12,

  },

});


