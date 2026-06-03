/** Always open the dating-profile nested stack at the entry resolver (shows typology intro when due). */
export function navigateToDatingProfileOnboardingEntry(
  navigation: { navigate: (name: string, params?: object) => void },
  userId: string,
): void {
  navigation.navigate('DatingProfileOnboarding', {
    userId,
    screen: 'DatingOnboardingEntry',
  });
}
