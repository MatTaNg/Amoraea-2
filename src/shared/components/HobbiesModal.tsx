import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

export const HobbiesModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => void;
  selectedIds: string[];
}> = ({ visible, onClose, onSave, selectedIds }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.back}>
      <View style={styles.card}>
        <Text style={styles.t}>Hobbies (stub)</Text>
        <Pressable onPress={() => onSave(selectedIds)} style={styles.btn}>
          <Text style={styles.bt}>Save</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text style={styles.c}>Close</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#0f1419', borderRadius: 14, padding: 20 },
  t: { color: '#EEF6FF', fontSize: 18, marginBottom: 12 },
  btn: { backgroundColor: '#5BA8E8', padding: 12, borderRadius: 10, alignItems: 'center' },
  bt: { color: '#fff', fontWeight: '600' },
  c: { color: '#7A9ABE', marginTop: 12, textAlign: 'center' },
});
