/**
 * LocationSearchPage — reusable location picker.
 * All city search is done on-device via Apple CoreLocation (expo-location).
 * No backend API or Google Maps needed — CLGeocoder handles everything natively.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

interface CityResult {
  city: string;
  country: string;
  region?: string;
  flag: string;
  lat: number;
  lng: number;
}

// Popular seed cities shown before user types anything
const POPULAR: CityResult[] = [
  { city: 'London',        country: 'United Kingdom', flag: '🇬🇧', lat: 51.5074,  lng: -0.1278  },
  { city: 'New York',      country: 'United States',  flag: '🇺🇸', lat: 40.7128,  lng: -74.0060 },
  { city: 'Dubai',         country: 'UAE',             flag: '🇦🇪', lat: 25.2048,  lng: 55.2708  },
  { city: 'Paris',         country: 'France',          flag: '🇫🇷', lat: 48.8566,  lng: 2.3522   },
  { city: 'Tokyo',         country: 'Japan',           flag: '🇯🇵', lat: 35.6762,  lng: 139.6503 },
  { city: 'Los Angeles',   country: 'United States',   flag: '🇺🇸', lat: 34.0522,  lng: -118.2437},
  { city: 'Singapore',     country: 'Singapore',       flag: '🇸🇬', lat: 1.3521,   lng: 103.8198 },
  { city: 'Sydney',        country: 'Australia',       flag: '🇦🇺', lat: -33.8688, lng: 151.2093 },
  { city: 'Mumbai',        country: 'India',           flag: '🇮🇳', lat: 19.0760,  lng: 72.8777  },
  { city: 'Toronto',       country: 'Canada',          flag: '🇨🇦', lat: 43.6532,  lng: -79.3832 },
  { city: 'Berlin',        country: 'Germany',         flag: '🇩🇪', lat: 52.5200,  lng: 13.4050  },
  { city: 'Amsterdam',     country: 'Netherlands',     flag: '🇳🇱', lat: 52.3676,  lng: 4.9041   },
  { city: 'Barcelona',     country: 'Spain',           flag: '🇪🇸', lat: 41.3851,  lng: 2.1734   },
  { city: 'Istanbul',      country: 'Turkey',          flag: '🇹🇷', lat: 41.0082,  lng: 28.9784  },
  { city: 'Bangkok',       country: 'Thailand',        flag: '🇹🇭', lat: 13.7563,  lng: 100.5018 },
];

function _flagFromCode(iso?: string | null): string {
  const code = (iso ?? '').toUpperCase().trim();
  if (code.length !== 2) return '🌍';
  return (
    String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65) +
    String.fromCodePoint(0x1F1E6 + code.charCodeAt(1) - 65)
  );
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

  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState<CityResult[]>(POPULAR);
  const [loading,    setLoading]    = useState(false);
  const [savingCity, setSavingCity] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();

    if (!q) {
      setResults(POPULAR);
      setLoading(false);
      return;
    }

    setLoading(true);
    abortRef.current = false;

    debounceRef.current = setTimeout(async () => {
      try {
        // Step 1: forward-geocode query → coordinates (Apple CLGeocoder)
        const geos = await Location.geocodeAsync(q);
        if (abortRef.current) return;

        if (!geos.length) {
          setResults([]);
          setLoading(false);
          return;
        }

        // Step 2: reverse-geocode each result → human-readable city/country
        const top = geos.slice(0, 6);
        const addresses = await Promise.all(
          top.map(g => Location.reverseGeocodeAsync({ latitude: g.latitude, longitude: g.longitude }))
        );
        if (abortRef.current) return;

        const seen = new Set<string>();
        const cityResults: CityResult[] = [];

        addresses.forEach((addrArr, i) => {
          const addr = addrArr[0];
          if (!addr) return;
          const city    = addr.city ?? addr.subregion ?? addr.district ?? addr.region ?? '';
          const country = addr.country ?? '';
          const key     = `${city.toLowerCase()}-${country.toLowerCase()}`;
          if (!city || seen.has(key)) return;
          seen.add(key);
          cityResults.push({
            city,
            country,
            region: addr.region ?? undefined,
            flag:   _flagFromCode(addr.isoCountryCode),
            lat:    top[i].latitude,
            lng:    top[i].longitude,
          });
        });

        setResults(cityResults);
      } catch {
        if (!abortRef.current) setResults([]);
      } finally {
        if (!abortRef.current) setLoading(false);
      }
    }, 400);

    return () => { abortRef.current = true; };
  }, [query]);

  const select = async (item: CityResult, index: number) => {
    Keyboard.dismiss();
    const cityKey = `${item.city}-${item.country}-${index}`;
    setSavingCity(cityKey);
    try {
      if (type === 'city') {
        // Travel mode: coords already resolved by Apple Maps above
        const res = await apiFetch<any>('/location/change-city', {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({
            city:      item.city,
            country:   item.country,
            latitude:  item.lat,
            longitude: item.lng,
          }),
        });
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

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.textSecondary} />
              <Text style={[styles.emptySub, { color: colors.textSecondary, marginTop: 8 }]}>
                Searching Apple Maps…
              </Text>
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
                  const cityKey  = `${item.city}-${item.country}-${i}`;
                  const isSaving = savingCity === cityKey;
                  const subtitle = item.region && item.region !== item.city
                    ? `${item.region} · ${item.country}`
                    : item.country;
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
                        <Text style={[styles.resultCountry, { color: colors.textSecondary }]}>{subtitle}</Text>
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
