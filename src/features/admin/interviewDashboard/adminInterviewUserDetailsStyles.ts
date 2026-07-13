import { Platform, StyleSheet } from 'react-native';

export const userDetailsStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#05060D',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  backText: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  headerDeleteText: {
    color: '#E87A7A',
    fontSize: 12,
    fontWeight: '600',
  },
  userCardDeleteTextDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    color: '#C8E4FF',
    fontSize: 22,
    fontWeight: '300',
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
  },
  headerSub: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  launchNotificationPhoneBold: {
    fontWeight: '700',
  },
  headerPassMeta: {
    color: '#9BB0CC',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  overrideButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  overrideChip: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(30,111,217,0.12)',
  },
  overrideChipActive: {
    borderColor: 'rgba(74, 222, 128, 0.55)',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  overrideChipText: {
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsLayoutSingle: {
    flex: 1,
    flexDirection: 'row',
  },
  detailsPaneFull: {
    flex: 1,
    minWidth: 0,
  },
  attemptTabsRowScroll: {
    maxHeight: 108,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
  },
  attemptTabsRowContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  attemptTab: {
    minWidth: 168,
    maxWidth: 240,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.16)',
    borderRadius: 8,
    backgroundColor: 'rgba(13,17,32,0.55)',
  },
  attemptTabActive: {
    backgroundColor: 'rgba(30,111,217,0.14)',
  },
  attemptTabLabel: {
    color: '#C8E4FF',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  attemptTabLabelActive: {
    color: '#E8F4FF',
    fontWeight: '600',
  },
  attemptTabOutcome: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'lowercase',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  innerTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  innerTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  innerTabActive: {
    backgroundColor: 'rgba(30,111,217,0.16)',
    borderColor: 'rgba(82,142,220,0.4)',
  },
  innerTabText: {
    color: '#7A9ABE',
    fontSize: 11,
  },
  innerTabTextActive: {
    color: '#C8E4FF',
  },
  blockText: {
    color: '#7A9ABE',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  transcriptLine: {
    color: '#E8F0F8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  inProgressSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,168,75,0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(212,168,75,0.06)',
    maxHeight: Platform.OS === 'web' ? 360 : 400,
  },
  inProgressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inProgressTitle: {
    color: '#E8D49A',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  refreshLink: {
    color: '#7A9ABE',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  inProgressMeta: {
    color: '#7A9ABE',
    fontSize: 11,
    marginBottom: 8,
  },
  inProgressScroll: {
    maxHeight: 260,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#7A9ABE',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyHint: {
    color: '#9BB8D9',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    maxWidth: 520,
  },
  emptyHintMono: {
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' : 'monospace',
    fontSize: 11,
    color: '#C8E4FF',
  },
  listErrorTitle: {
    color: '#fecaca',
    fontSize: 15,
    fontWeight: '600',
  },
  listErrorDetail: {
    color: 'rgba(254,226,226,0.92)',
    fontSize: 12,
    lineHeight: 18,
  },
});
