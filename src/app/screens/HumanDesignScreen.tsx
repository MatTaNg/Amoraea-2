import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { PickerField } from '@ui/components/PickerField';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { getHumanDesign, setHumanDesign, HumanDesignData } from '@utilities/storage/HumanDesignStorage';

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: String(i + 1),
}));

const YEARS = Array.from({ length: 71 }, (_, i) => {
  const y = 1955 + i;
  return { value: String(y), label: String(y) };
}).reverse();

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i).padStart(2, '0'),
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: String(i).padStart(2, '0'),
  label: i.toString().padStart(2, '0'),
}));

const PLACES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'India', 'China',
  'Japan', 'Brazil', 'Mexico', 'Spain', 'Italy', 'South Korea', 'Netherlands', 'Poland',
  'Russia', 'South Africa', 'Argentina', 'Nigeria', 'Egypt', 'Philippines', 'Vietnam', 'Thailand',
  'Indonesia', 'Malaysia', 'Singapore', 'New Zealand', 'Ireland', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Switzerland', 'Austria', 'Belgium', 'Portugal', 'Greece', 'Turkey', 'Israel',
  'Saudi Arabia', 'UAE', 'Pakistan', 'Bangladesh', 'Colombia', 'Chile', 'Peru', 'Venezuela',
  'Ukraine', 'Romania', 'Czech Republic', 'Hungary', 'Other',
].map((p) => ({ value: p, label: p }));

export const HumanDesignScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  const [data, setData] = useState<HumanDesignData>({
    dateOfBirth: null,
    timeOfBirth: null,
    placeOfBirth: null,
  });
  const [month, setMonth] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [hour, setHour] = useState<string | null>(null);
  const [minute, setMinute] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHumanDesign(userId).then((stored) => {
      if (stored) {
        setData(stored);
        if (stored.dateOfBirth) {
          const [y, m, d] = stored.dateOfBirth.split('-');
          setYear(y);
          setMonth(m);
          setDay(d);
        }
        if (stored.timeOfBirth) {
          const [h, m] = stored.timeOfBirth.split(':');
          setHour(h);
          setMinute(m);
        }
        setPlace(stored.placeOfBirth);
      }
    });
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    const dateStr =
      year && month && day ? `${year}-${month}-${day}` : null;
    const timeStr =
      hour != null && minute != null ? `${hour}:${minute}` : null;
    const newData: HumanDesignData = {
      dateOfBirth: dateStr,
      timeOfBirth: timeStr,
      placeOfBirth: place || null,
    };
    await setHumanDesign(userId, newData);
    setSaving(false);
    navigation.goBack();
  };

  return (
    <SafeAreaContainer>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Enter your birth details to calculate your Human Design chart. This information is optional.
        </Text>

        <Text style={styles.sectionTitle}>Date of Birth</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <PickerField
              label="Month"
              value={month}
              options={MONTHS}
              onSelect={setMonth}
            />
          </View>
          <View style={styles.flex1}>
            <PickerField
              label="Day"
              value={day}
              options={DAYS}
              onSelect={setDay}
            />
          </View>
          <View style={styles.flex1}>
            <PickerField
              label="Year"
              value={year}
              options={YEARS}
              onSelect={setYear}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Time of Birth</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <PickerField
              label="Hour"
              value={hour}
              options={HOURS}
              onSelect={setHour}
            />
          </View>
          <View style={styles.flex1}>
            <PickerField
              label="Minute"
              value={minute}
              options={MINUTES}
              onSelect={setMinute}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Place of Birth</Text>
        <PickerField
          label="Country / Place"
          value={place}
          options={PLACES}
          onSelect={setPlace}
          placeholder="Select place of birth"
        />

        <View style={styles.saveSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save" onPress={handleSave} loading={saving} style={styles.saveButton} />
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  intro: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  saveSpacer: {
    height: spacing.xxl,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    width: '100%',
  },
});
