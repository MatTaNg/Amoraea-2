import React from 'react';
import { View, Text } from 'react-native';
import {
  FullAssessmentTab,
  ProfileIntentTab,
  type AdminUserProfileRecord,
} from '@app/screens/admin/AdminProfileAssessmentTabs';
import { AdminDatingProfileTab } from '@app/screens/admin/AdminDatingProfileTab';
import { AdminInterviewSummaryTab } from '@features/admin/interviewDashboard/AdminInterviewSummaryTab';
import { AdminInterviewReasoningTab } from '@features/admin/interviewDashboard/AdminInterviewReasoningTab';
import { AdminInterviewTranscriptTab } from '@features/admin/interviewDashboard/AdminInterviewTranscriptTab';
import { AdminInterviewDepthSignalsTab } from '@features/admin/interviewDashboard/AdminInterviewDepthSignalsTab';
import { detailTabStyles } from '@features/admin/interviewDashboard/adminInterviewDetailTabStyles';
import type {
  AdminAttemptInnerTabId,
  AttemptRow,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function renderAdminInterviewDetailTabContent(
  activeInnerTab: AdminAttemptInnerTabId,
  opts: {
    profileUser: AdminUserProfileRecord;
    profileLoading: boolean;
    selectedAttempt: AttemptRow | null;
    onRefreshData: () => void;
    candidateUser: UserRow;
  },
): React.ReactNode {
  const { profileUser, profileLoading, selectedAttempt, onRefreshData, candidateUser } = opts;

  if (activeInnerTab === 'profile_intent') {
    if (profileLoading) {
      return (
        <View style={detailTabStyles.emptyState}>
          <Text style={detailTabStyles.emptyText}>Loading profile & intent…</Text>
        </View>
      );
    }
    return <ProfileIntentTab user={profileUser} />;
  }

  if (activeInnerTab === 'dating_profile') {
    return <AdminDatingProfileTab userId={candidateUser.id} />;
  }

  if (!selectedAttempt) {
    return (
      <View style={detailTabStyles.emptyState}>
        <Text style={detailTabStyles.emptyText}>No completed interview attempt for this tab yet.</Text>
      </View>
    );
  }

  switch (activeInnerTab) {
    case 'summary':
      return (
        <AdminInterviewSummaryTab
          attempt={selectedAttempt}
          onAttemptMutated={onRefreshData}
          candidateUser={candidateUser}
          profileUser={profileUser}
        />
      );
    case 'reasoning':
      return (
        <AdminInterviewReasoningTab
          attempt={selectedAttempt}
          onRefreshAfterReasoning={onRefreshData}
        />
      );
    case 'transcript':
      return <AdminInterviewTranscriptTab attempt={selectedAttempt} />;
    case 'depth':
      return (
        <AdminInterviewDepthSignalsTab
          attempt={selectedAttempt}
          user={profileLoading ? null : profileUser}
        />
      );
    case 'full_assessment':
      if (profileLoading) {
        return (
          <View style={detailTabStyles.emptyState}>
            <Text style={detailTabStyles.emptyText}>Loading full assessment…</Text>
          </View>
        );
      }
      return <FullAssessmentTab attempt={selectedAttempt} user={profileUser} />;
    default:
      return null;
  }
}
