-- Life domain question ids added or changed (answers stored in life_domain_answers.question_id / answer).
-- Legacy free-text sleep answers remain under question_id = 'sleepScheduleDescription'.
-- New onboarding uses question_id = 'sleepSchedule' (dropdown).
-- New family question: petStatus. New health optional question: chronicIllnessStatus.

-- No column changes required; ensureLifeDomainQuestionsExist creates rows on first save.
