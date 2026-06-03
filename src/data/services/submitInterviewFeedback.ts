import { Platform } from 'react-native';
import { supabase } from '@data/supabase/client';
import type { FeedbackCategory } from '@/shared/constants/feedbackCategories';

function pagePath(): string | null {
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
    const w = globalThis as unknown as { location?: { pathname?: string } };
    if (w.location?.pathname) return w.location.pathname;
  }
  return null;
}

function userAgentString(): string | null {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }
  return null;
}

export async function submitInterviewFeedback(params: {
  userId: string | null;
  category: FeedbackCategory | string;
  message: string;
  attemptId?: string | null;
  rating?: number | null;
  pageContext?: string | null;
}): Promise<{ error: string | null }> {
  const trimmed = params.message.trim();
  if (!trimmed) return { error: null };

  const { error } = await supabase.from('interview_feedback').insert({
    attempt_id: params.attemptId ?? null,
    user_id: params.userId ?? null,
    category: params.category,
    message: trimmed,
    rating: params.rating ?? null,
    page_context: params.pageContext ?? pagePath(),
    user_agent: userAgentString(),
  });

  return { error: error?.message ?? null };
}
