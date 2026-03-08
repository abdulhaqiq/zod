/**
 * LocationSearchPage — reusable location picker.
 * Driven by query param `type`: "living" → "Living Now", "hometown" → "Hometown"
 *
 * After selecting a city the user is navigated back.
 * In a real app you'd persist the value via context/store; here we just go back.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Mock city data ───────────────────────────────────────────────────────────

const CITIES = [
  { city: 'New York',       country: 'United States',   flag: '🇺🇸' },
  { city: 'Los Angeles',    country: 'United States',   flag: '🇺🇸' },
  { city: 'Chicago',        country: 'United States',   flag: '🇺🇸' },
  { city: 'Houston',        country: 'United States',   flag: '🇺🇸' },
  { city: 'London',         country: 'United Kingdom',  flag: '🇬🇧' },
  { city: 'Manchester',     country: 'United Kingdom',  flag: '🇬🇧' },
  { city: 'Toronto',        country: 'Canada',          flag: '🇨🇦' },
  { city: 'Vancouver',      country: 'Canada',          flag: '🇨🇦' },
  { city: 'Sydney',         country: 'Australia',       flag: '🇦🇺' },
  { city: 'Melbourne',      country: 'Australia',       flag: '🇦🇺' },
  { city: 'Paris',          country: 'France',          flag: '🇫🇷' },
  { city: 'Berlin',         country: 'Germany',         flag: '🇩🇪' },
  { city: 'Dubai',          country: 'UAE',             flag: '🇦🇪' },
  { city: 'Singapore',      country: 'Singapore',       flag: '🇸🇬' },
  { city: 'Tokyo',          country: 'Japan',           flag: '🇯🇵' },
  { city: 'Seoul',          country: 'South Korea',     flag: '🇰🇷' },
  { city: 'Mumbai',         country: 'India',           flag: '🇮🇳' },
  { city: 'Delhi',          country: 'India',           flag: '🇮🇳' },
  { city: 'Lagos',          country: 'Nigeria',         flag: '🇳🇬' },
  { city: 'Nairobi',        country: 'Kenya',           flag: '🇰🇪' },
  { city: 'Cape Town',      country: 'South Africa',    flag: '🇿🇦' },
  { city: 'São Paulo',      country: 'Brazil',          flag: '🇧🇷' },
  { city: 'Mexico City',    country: 'Mexico',          flag: '🇲🇽' },
  { city: 'Amsterdam',      country: 'Netherlands',     flag: '🇳🇱' },
  { city: 'Barcelona',      country: 'Spain',           flag: '🇪🇸' },
  { city: 'Istanbul',       country: 'Turkey',          flag: '🇹🇷' },
  { city: 'Accra',          country: 'Ghana',           flag: '🇬🇭' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LocationSearchPage() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { colors } = useAppTheme();

  const title = type === 'hometown' ? 'Hometown'
    : type === 'city'     ? 'Change Location'
    : 'Living Now';
  const subtitle = type === 'hometown'
    ? 'Where did you grow up?'
    : type === 'city'
    ? 'Search for any city in the world'
    : 'Where do you currently live?';

  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CITIES;
    return CITIES.filter(
      c => c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
    );
  }, [query]);

  const select = (city: string, country: string) => {
    Keyboard.dismiss();
    // In production: persist via context/store
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Search bar lives inside the gradient header, just like filter tabs */}
        <ScreenHeader title={title} onClose={() => router.back()} colors={colors}>
          <Squircle
            style={styles.searchBox}
            cornerRadius={16}
            cornerSmoothing={1}
            fillColor={colors.surface}
            strokeColor={colors.border}
            strokeWidth={1}
          >
            <Ionicons name="search-outline" size={17} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={`Search ${title.toLowerCase()}…`}
              placeholderTextColor={colors.placeholder}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              selectionColor={colors.text}
              clearButtonMode="while-editing"
            />
          </Squircle>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>{subtitle}</Text>
        </ScreenHeader>

        {/* Results */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.length === 0 ? (
            <View style={styles.emptyState}>
              <Squircle style={styles.emptyIcon} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface}>
                <Ionicons name="location-outline" size={28} color={colors.textTertiary} />
              </Squircle>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No results</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Try a different city or country name
              </Text>
            </View>
          ) : (
            <Squircle
              style={styles.resultGroup}
              cornerRadius={22}
              cornerSmoothing={1}
              fillColor={colors.surface}
              strokeColor={colors.border}
              strokeWidth={1}
            >
              {results.map((item, i) => (
                <Pressable
                  key={`${item.city}-${item.country}`}
                  onPress={() => select(item.city, item.country)}
                  style={({ pressed }) => [
                    styles.resultRow,
                    i < results.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.resultFlag}>{item.flag}</Text>
                  <View style={styles.resultText}>
                    <Text style={[styles.resultCity, { color: colors.text }]}>{item.city}</Text>
                    <Text style={[styles.resultCountry, { color: colors.textSecondary }]}>{item.country}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
                </Pressable>
              ))}
            </Squircle>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  flex:           { flex: 1 },

  // Search (inside header gradient)
  searchBox:      { flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 12, gap: 8 },
  searchInput:    { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },
  subtitleText:   { fontSize: 12, fontFamily: 'ProductSans-Regular', paddingLeft: 4 },

  // Results
  scroll:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  resultGroup:    { overflow: 'hidden' },
  resultRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  resultFlag:     { fontSize: 22 },
  resultText:     { flex: 1, gap: 2 },
  resultCity:     { fontSize: 15, fontFamily: 'ProductSans-Bold' },
  resultCountry:  { fontSize: 12, fontFamily: 'ProductSans-Regular' },

  // Empty
  emptyState:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:      { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:     { fontSize: 17, fontFamily: 'ProductSans-Bold' },
  emptySub:       { fontSize: 14, fontFamily: 'ProductSans-Regular', textAlign: 'center' },
});
