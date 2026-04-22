import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@data/supabase/client';

const BG = '#0a1628';
const ACCENT = '#2563eb';

const CATEGORIES = ['Something broke', 'Suggestion', 'Compliment', 'Other'] as const;

type Props = {
  attemptId?: string;
  userId?: string;
};

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

export function FeedbackBubble({ attemptId, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const displayStars = hoverRating ?? rating;
  const canSubmit = message.trim().length > 0;

  const reset = useCallback(() => {
    setCategory(null);
    setHoverRating(null);
    setRating(null);
    setMessage('');
    setError(null);
    setSuccess(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !open || typeof window === 'undefined') return;
    const onKey = (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const toggleCategory = (label: string) => {
    setCategory((c) => (c === label ? null : label));
  };

  const onSubmit = async () => {
    if (!canSubmit || sending) return;
    setError(null);
    setSending(true);
    const { error: insErr } = await supabase.from('interview_feedback').insert({
      attempt_id: attemptId ?? null,
      user_id: userId ?? null,
      category,
      message: message.trim(),
      rating,
      page_context: pagePath(),
      user_agent: userAgentString(),
    });
    setSending(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setOpen(false);
      reset();
    }, 2200);
  };

  return (
    <>
      <View
        style={[styles.fabHost, { pointerEvents: 'box-none' as const }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Pressable
          onPress={() => {
            setOpen(true);
            setError(null);
            setSuccess(false);
          }}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Send feedback"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={ACCENT} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={styles.sheet}>
            {success ? (
              <Text style={styles.successText}>Thanks — your feedback was sent.</Text>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Feedback</Text>
                <Text style={styles.label}>Category</Text>
                <View style={styles.pillRow}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => toggleCategory(c)}
                      style={({ pressed }) => [
                        styles.pill,
                        category === c && styles.pillOn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.pillText, category === c && styles.pillTextOn]} numberOfLines={1}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Rating (optional)</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setRating((r) => (r === n ? null : n))}
                      {...(Platform.OS === 'web'
                        ? {
                            onMouseEnter: () => setHoverRating(n),
                            onMouseLeave: () => setHoverRating(null),
                          }
                        : {})}
                    >
                      <Ionicons
                        name={displayStars != null && n <= displayStars ? 'star' : 'star-outline'}
                        size={28}
                        color={n <= (displayStars ?? 0) ? '#FBBF24' : 'rgba(148,163,184,0.7)'}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what happened or what you’d like…"
                  placeholderTextColor="rgba(148,163,184,0.6)"
                  multiline
                  style={styles.textarea}
                  textAlignVertical="top"
                />
                {error ? <Text style={styles.errText}>{error}</Text> : null}
                <View style={styles.rowActions}>
                  <Pressable onPress={close} style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.8 }]}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onSubmit()}
                    disabled={!canSubmit || sending}
                    style={({ pressed }) => [
                      styles.btnPrimary,
                      (!canSubmit || sending) && styles.btnDisabled,
                      pressed && canSubmit && !sending && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnPrimaryText}>{sending ? 'Sending…' : 'Submit'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const BOTTOM = 20;
const RIGHT = 16;
const FAB = 48;

const styles = StyleSheet.create({
  fabHost: {
    position: 'absolute' as const,
    right: RIGHT,
    bottom: BOTTOM,
    zIndex: 10050,
    elevation: 12,
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    backgroundColor: BG,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0a1628',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 13, 0.55)',
  },
  sheet: {
    position: 'absolute' as const,
    right: RIGHT,
    bottom: BOTTOM + FAB + 12,
    maxWidth: 400,
    width: '90%',
    minWidth: 280,
    maxHeight: '80%',
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    borderRadius: 12,
    padding: 16,
  },
  sheetTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(10, 22, 40, 0.6)',
  },
  pillOn: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: ACCENT,
  },
  pillText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  pillTextOn: {
    color: '#E2E8F0',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  textarea: {
    minHeight: 100,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    borderRadius: 8,
    padding: 10,
    color: '#E2E8F0',
    backgroundColor: 'rgba(5, 9, 18, 0.6)',
  },
  errText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 8,
  },
  successText: {
    color: '#A7F3D0',
    fontSize: 16,
    textAlign: 'center' as const,
    paddingVertical: 12,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  btnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnGhostText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnPrimaryText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
});
