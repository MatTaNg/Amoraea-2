import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getWebConfirmState, subscribeWebConfirm, type WebConfirmState } from './webConfirmBridge';
import { remoteLog } from '@utilities/remoteLog';

/**
 * Renders in-app confirm/alert on **web** so mobile browsers never rely on `window.confirm` / `window.alert`
 * (often suppressed in Safari / standalone PWA). Native uses system `Alert` from `confirmDialog.ts`.
 */
export function WebConfirmModalHost(): React.ReactElement | null {
  const [snap, setSnap] = useState<WebConfirmState>(() => getWebConfirmState());

  useEffect(() => subscribeWebConfirm(() => setSnap(getWebConfirmState())), []);

  useEffect(() => {
    if (Platform.OS !== 'web' || snap == null) return;
    // #region agent log
    void remoteLog('[DBG] WebConfirmModal_visible', {
      hypothesisId: 'H4_fix_verify',
      kind: snap.kind,
      runId: 'post-fix',
    });
    // #endregion
  }, [snap]);

  if (Platform.OS !== 'web' || snap == null) {
    return null;
  }

  if (snap.kind === 'alert') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={snap.onDismiss}>
        <Pressable style={styles.backdrop} onPress={snap.onDismiss}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{snap.title}</Text>
            <Text style={styles.body}>{snap.message}</Text>
            <Pressable style={styles.primaryBtn} onPress={snap.onDismiss}>
              <Text style={styles.primaryBtnText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const confirmBtnStyle = snap.destructive ? styles.destructiveBtn : styles.primaryBtn;
  const confirmTextStyle = snap.destructive ? styles.destructiveBtnText : styles.primaryBtnText;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={snap.onCancel}>
      <Pressable style={styles.backdrop} onPress={snap.onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{snap.title}</Text>
          <Text style={styles.body}>{snap.message}</Text>
          <View style={styles.row}>
            <Pressable style={styles.secondaryBtn} onPress={snap.onCancel}>
              <Text style={styles.secondaryBtnText}>{snap.cancelText}</Text>
            </Pressable>
            <Pressable style={confirmBtnStyle} onPress={snap.onConfirm}>
              <Text style={confirmTextStyle}>{snap.confirmText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0E141D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    padding: 20,
  },
  title: {
    color: '#E8F0F8',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  body: {
    color: '#B8C5D6',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: 'rgba(82,142,220,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.5)',
  },
  primaryBtnText: {
    color: '#E8F0F8',
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: 'rgba(220,90,90,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220,120,120,0.45)',
  },
  destructiveBtnText: {
    color: '#FFB4B4',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#8EC6FF',
    fontSize: 15,
    fontWeight: '600',
  },
});
