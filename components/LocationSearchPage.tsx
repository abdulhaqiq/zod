/**
 * LocationSearchPage — reusable location picker.
 * Driven by query param `type`: "living" → "Living Now", "hometown" → "Hometown"
 * Uses GET /location/city-search?q=… (Google Places Autocomplete or static list).
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { API_V1, apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

interface CityResult {
  city: string;
  country: string;
  flag: string;
  place_id?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LocationSearchPage() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { colors } = useAppTheme();
  const { token, updateProfile } = useAuth();

  const title = type === 'hometown' ? 'Hometown'
    : type === 'city'     ? 'Change Location'
    : 'Living Now';
  const subtitle = type === 'hometown'
    ? 'Where did you grow up?'
    : type === 'city'
    ? 'Search for any city in the world'
    : 'Where do you currently live?';

  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<CityResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [savingCity, setSavingCity] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load popular cities on mount
  useEffect(() => {
    const loadPopular = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_V1}/location/city-search`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    loadPopular();
  }, [token]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      // On clear, reload popular
      const reload = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_V1}/location/city-search`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setResults(data.results ?? []);
          }
        } catch { /* ignore */ }
        setLoading(false);
      };
      reload();
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_V1}/location/city-search?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
  }, [query, token]);

  const select = async (item: CityResult, index: number) => {
    Keyboard.dismiss();
    const cityKey = item.place_id || `${item.city}-${item.country}-${index}`;
    setSavingCity(cityKey);
    try {
      if (type === 'city') {
        // Travel / change-location mode: geocode the city and update discovery lat/lon
        const res = await apiFetch<any>('/location/change-city', {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({
            city:     item.city,
            country:  item.country,
            place_id: item.place_id ?? null,
          }),
        });
        // Sync profile context with new city/country/travel state
        updateProfile({
          city:                res.city,
          country:             res.country,
          travel_mode_enabled: true,
          travel_city:         res.city,
          travel_country:      res.country,
        });
      } else {
        // Living Now / Hometown: update profile display field only
        const field = type === 'hometown' ? 'hometown' : 'city';
        const updated = await apiFetch<any>('/profile/me', {
          method: 'PATCH',
          token: token ?? undefined,
          body: JSON.stringify({ [field]: item.city }),
        });
        updateProfile(updated);
      }
      router.back();
    } catch { /* ignore */ }
    finally { setSavingCity(null); }
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title={title} onClose={() => router.back()} colors={colors}>
          <Squircle style={styles.searchBox} cornerRadius={16} cornerSmoothing={1}
            fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
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
            {loading && <ActivityIndicator size="small" color={colors.textSecondary} />}
          </Squircle>
        </ScreenHeader>

        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>{subtitle}</Text>

          {loading && results.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : results.length === 0 && query.length >= 2 ? (
            <View style={styles.emptyState}>
              <Squircle style={styles.emptyIcon} cornerRadius={22} cornerSmoothing={1} fillColor={colors.surface}>
                <Ionicons name="location-outline" size={28} color={colors.textTertiary} />
              </Squircle>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No results</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Try a different city or country name
              </Text>
            </View>
          ) : results.length > 0 ? (
            <>
              {!query.trim() && (
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>POPULAR CITIES</Text>
              )}
              <Squircle style={styles.resultGroup} cornerRadius={22} cornerSmoothing={1}
                fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
                {results.map((item, i) => {
                  const cityKey = item.place_id || `${item.city}-${item.country}-${i}`;
                  const isSaving = savingCity === cityKey;
                  return (
                    <Pressable
                      key={cityKey}
                      onPress={() => select(item, i)}
                      disabled={savingCity !== null}
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
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
                      )}
                    </Pressable>
                  );
                })}
              </Squircle>
            </>
          ) : null}
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
  subtitleText:   { fontSize: 12, fontFamily: 'ProductSans-Regular', paddingHorizontal: 4, marginBottom: 12 },

  // Results
  scroll:         { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  sectionLabel:   { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.2, marginBottom: 8, marginLeft: 2 },
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
