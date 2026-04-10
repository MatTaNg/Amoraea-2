import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHumanDesign, setHumanDesign } from '../HumanDesignStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('HumanDesignStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when missing', async () => {
    await expect(getHumanDesign('u1')).resolves.toBeNull();
  });

  it('round-trips birth data', async () => {
    const data = {
      dateOfBirth: '1990-05-01',
      timeOfBirth: '14:30',
      placeOfBirth: 'NYC',
    };
    await setHumanDesign('u1', data);
    await expect(getHumanDesign('u1')).resolves.toEqual(data);
  });
});
