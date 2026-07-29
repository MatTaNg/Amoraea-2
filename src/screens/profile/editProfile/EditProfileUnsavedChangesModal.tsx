import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const FONT_BODY =
  Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type EditProfileUnsavedChangesModalProps = {
  visible: boolean;
  saving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export const EditProfileUnsavedChangesModal: React.FC<
  EditProfileUnsavedChangesModalProps
> = ({ visible, saving, onCancel, onDiscard, onSave }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onCancel}
  >
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Unsaved changes</Text>
        <Text style={styles.message}>
          You have unsaved changes. Would you like to save them before leaving?
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={onCancel}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.destructiveButton]}
            onPress={onDiscard}
            disabled={saving}
          >
            <Text style={styles.destructiveButtonText}>Don't save</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#12121a',
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  title: {
    fontFamily:
      Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 10,
  },
  message: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  destructiveButton: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  buttonDisabled: {
    opacity: 0.78,
  },
  secondaryButtonText: {
    fontFamily: FONT_BODY,
    color: '#E8F0F8',
    fontSize: 14,
    fontWeight: '600',
  },
  destructiveButtonText: {
    fontFamily: FONT_BODY,
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonText: {
    fontFamily: FONT_BODY,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
