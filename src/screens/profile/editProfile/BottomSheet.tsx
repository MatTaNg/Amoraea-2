import React, { useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ScrollView,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type OptionAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DESKTOP_BREAKPOINT = 768;
const DROPDOWN_MAX_W = 420;
const DROPDOWN_MAX_H = 380;
const DROPDOWN_MIN_H = 140;
const VIEWPORT_PAD = 12;

export const OptionPickerTrigger: React.FC<{
  style?: StyleProp<ViewStyle>;
  onOpen: (anchor: OptionAnchor) => void;
  children: React.ReactNode;
}> = ({ style, onOpen, children }) => {
  const ref = useRef<View>(null);
  return (
    <View ref={ref} collapsable={false} style={style}>
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.triggerFill}
        onPress={() => {
          ref.current?.measureInWindow((x, y, width, height) => {
            onOpen({ x, y, width, height });
          });
        }}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

export const BottomSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** When set on web desktop, menu is anchored like a dropdown instead of a bottom sheet. */
  anchor?: OptionAnchor | null;
  children: React.ReactNode;
}> = ({ visible, onClose, title, anchor, children }) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const desktopDropdown =
    Platform.OS === 'web' && winW >= DESKTOP_BREAKPOINT && anchor != null;

  const dropdownLayout = useMemo(() => {
    if (!desktopDropdown || !anchor) return null;
    const menuW = Math.min(DROPDOWN_MAX_W, Math.max(220, anchor.width));
    let left = anchor.x;
    if (left + menuW > winW - VIEWPORT_PAD) left = Math.max(VIEWPORT_PAD, winW - menuW - VIEWPORT_PAD);
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

    const preferredTop = anchor.y + anchor.height + 6;
    const availableBelow = Math.max(0, winH - preferredTop - VIEWPORT_PAD);
    const availableAbove = Math.max(0, anchor.y - 6 - VIEWPORT_PAD);
    const shouldOpenBelow = availableBelow >= DROPDOWN_MIN_H || availableBelow >= availableAbove;
    const maxHeight = Math.max(
      DROPDOWN_MIN_H,
      Math.min(DROPDOWN_MAX_H, shouldOpenBelow ? availableBelow : availableAbove)
    );
    const top = shouldOpenBelow
      ? preferredTop
      : Math.max(VIEWPORT_PAD, anchor.y - maxHeight - 6);

    return { top, left, width: menuW, maxHeight };
  }, [desktopDropdown, anchor, winW, winH]);

  if (!visible) {
    return null;
  }

  if (desktopDropdown && dropdownLayout) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.desktopRoot} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss menu" />
          <View
            style={[
              styles.dropdownPanel,
              {
                top: dropdownLayout.top,
                left: dropdownLayout.left,
                width: dropdownLayout.width,
                maxHeight: dropdownLayout.maxHeight,
              },
            ]}
            accessibilityRole="menu"
          >
            {title ? <Text style={styles.dropdownTitle}>{title}</Text> : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.dropdownScroll}
              nestedScrollEnabled
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.back} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.sheetScroll}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  triggerFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  desktopRoot: {
    flex: 1,
  },
  dropdownPanel: {
    position: 'absolute',
    backgroundColor: '#0f1419',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 2,
  },
  dropdownTitle: {
    color: '#EEF6FF',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  dropdownScroll: {
    flexGrow: 0,
  },
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#0f1419',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  sheetScroll: {
    maxHeight: 480,
  },
  title: { color: '#EEF6FF', fontSize: 18, fontWeight: '600', marginBottom: 12 },
});
