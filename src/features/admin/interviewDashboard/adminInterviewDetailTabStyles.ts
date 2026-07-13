import { StyleSheet } from 'react-native';

export const detailTabStyles = StyleSheet.create({
  innerTabContent: {
    flex: 1,
    padding: 14,
  },
  sectionTitle: {
    color: '#C8E4FF',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  metaLabel: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  metaValue: {
    color: '#E8F0F8',
    fontSize: 12,
  },
  block: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(13,17,32,0.5)',
  },
  blockTitle: {
    color: '#C8E4FF',
    fontSize: 13,
    marginBottom: 6,
  },
  blockText: {
    color: '#7A9ABE',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  depthSignalFootnote: {
    fontSize: 11,
    color: 'rgba(180, 198, 220, 0.78)',
    lineHeight: 16,
    marginBottom: 10,
    marginTop: 2,
  },
  defenseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  defenseGridCell: {
    width: '47%',
    minWidth: 140,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  defenseGridTitle: {
    color: 'rgba(230, 238, 248, 0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  defenseGridState: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  defenseCardFootnote: {
    fontSize: 10,
    color: 'rgba(180, 198, 220, 0.72)',
    lineHeight: 15,
    marginTop: 8,
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
  transcriptLine: {
    color: '#E8F0F8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  reprocessButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.5)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(30,111,217,0.14)',
    alignItems: 'center',
  },
  reprocessButtonText: {
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '600',
  },
});
