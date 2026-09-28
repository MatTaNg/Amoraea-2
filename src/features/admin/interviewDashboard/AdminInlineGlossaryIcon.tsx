import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function AdminInlineGlossaryIcon({
  text,
  accessibilityLabel = 'Show explanation',
}: {
  text: string;
  accessibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.icon}>ⓘ</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.body}>{text}</Text>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.dismiss} accessibilityRole="button">
              <Text style={styles.dismissText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function AdminGlossaryHeading({
  title,
  glossaryText,
  titleStyle,
}: {
  title: string;
  glossaryText: string;
  titleStyle?: object;
}) {
  return (
    <View style={styles.headingRow}>
      <Text style={[styles.headingTitle, titleStyle]}>{title}</Text>
      <AdminInlineGlossaryIcon text={glossaryText} accessibilityLabel={`Explain ${title}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(122, 154, 190, 0.18)',
  },
  icon: { color: '#9BB0CC', fontSize: 12, fontWeight: '700', lineHeight: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    maxWidth: 420,
    width: '100%',
    backgroundColor: '#12141f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 154, 190, 0.35)',
    padding: 16,
  },
  body: { color: '#E8F0F8', fontSize: 13, lineHeight: 20 },
  dismiss: {
    alignSelf: 'flex-end',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(30,111,217,0.25)',
  },
  dismissText: { color: '#C8E4FF', fontSize: 12, fontWeight: '600' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  headingTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
