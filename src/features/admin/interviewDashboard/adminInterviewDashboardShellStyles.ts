import { StyleSheet, Platform } from 'react-native';

export const dashboardShellStyles = StyleSheet.create({
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
  headerTitle: {
    color: '#C8E4FF',
    fontSize: 22,
    fontWeight: '300',
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
  },
  backText: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    paddingBottom: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: 'rgba(30,111,217,0.2)',
    borderColor: 'rgba(82,142,220,0.45)',
  },
  filterChipText: {
    color: '#7A9ABE',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#C8E4FF',
  },
});
