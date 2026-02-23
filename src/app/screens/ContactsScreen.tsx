import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { AsyncStorageService } from '@utilities/storage/AsyncStorageService';

const storageService = new AsyncStorageService();

const PRIVACY_NOTE =
  'We never store your address book. We only store encrypted fingerprints to find overlap.';

interface ContactItem {
  id: string;
  name: string;
  excluded: boolean;
}

export const ContactsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const userId = route?.params?.userId ?? '';
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    Contacts.getPermissionsAsync().then(({ status }) => {
      setPermissionGranted(status === 'granted');
      if (status === 'granted') {
        loadContacts();
      }
    });
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(
        data.map((c, i) => ({
          id: c.id || `contact_${i}`,
          name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown',
          excluded: false,
        }))
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const requestPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    setPermissionGranted(status === 'granted');
    if (status === 'granted') {
      loadContacts();
    } else {
      Alert.alert('Permission needed', 'Contact access lets us find matches among people you know.');
    }
  };

  const toggleExcluded = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, excluded: !c.excluded } : c))
    );
  };

  const onDone = async () => {
    if (userId) {
      await storageService.addConnectedNetwork(userId, 'phone');
    }
    Alert.alert('Done', 'Your preferences have been saved. We only use encrypted fingerprints to find matches.');
    navigation.goBack();
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (permissionGranted === null) {
    return (
      <SafeAreaContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaContainer>
    );
  }

  if (!permissionGranted) {
    return (
      <SafeAreaContainer>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Share your contacts</Text>
          <Text style={styles.subtitle}>
            Optionally share your phone contacts to find matches among people you know.
          </Text>
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            <Text style={styles.privacyText}>{PRIVACY_NOTE}</Text>
          </View>
          <Button title="Share contacts" onPress={requestPermission} style={styles.shareButton} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer>
      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        <Text style={styles.privacyBannerText}>{PRIVACY_NOTE}</Text>
      </View>
      <Text style={styles.includeHint}>
        All contacts are included by default. Toggle to exclude anyone from matching.
      </Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search contacts..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={colors.textSecondary}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.contactList}>
          {filteredContacts.map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <Text style={styles.contactName} numberOfLines={1}>
                {contact.name}
              </Text>
              <View style={styles.excludeSwitch}>
                <Text style={styles.excludeLabel}>
                  {contact.excluded ? 'Excluded' : 'Included'}
                </Text>
                <Switch
                  value={contact.excluded}
                  onValueChange={() => toggleExcluded(contact.id)}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={contact.excluded ? colors.primary : colors.surface}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Button title="Done" onPress={onDone} />
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  privacyText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  shareButton: {
    marginBottom: spacing.md,
    width: '100%',
  },
  skipButton: {
    padding: spacing.md,
  },
  skipText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    margin: spacing.lg,
    borderRadius: 8,
    gap: spacing.sm,
  },
  privacyBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  includeHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  contactList: {
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactName: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  excludeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  excludeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
