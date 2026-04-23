import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGE_KEY = '@app_language';

export interface Language {
  code: string;
  name: string;           // English name
  nativeName: string;     // Name in its own script
  flag: string;           // Emoji flag
  rtl?: boolean;
}

/** Top 10 most spoken languages by total speakers (L1 + L2). */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    flag: '🇬🇧' },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',         flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',        flag: '🇮🇳' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',     flag: '🇪🇸' },
  { code: 'fr', name: 'French',     nativeName: 'Français',    flag: '🇫🇷' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',      flag: '🇸🇦', rtl: true },
  { code: 'bn', name: 'Bengali',    nativeName: 'বাংলা',         flag: '🇧🇩' },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',     flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',   flag: '🇵🇹' },
  { code: 'ur', name: 'Urdu',       nativeName: 'اردو',         flag: '🇵🇰', rtl: true },
];

export const DEFAULT_LANGUAGE = LANGUAGES[0]; // English

export async function getStoredLanguage(): Promise<Language> {
  try {
    const code = await AsyncStorage.getItem(LANGUAGE_KEY);
    return LANGUAGES.find(l => l.code === code) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export async function setStoredLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang.code);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LanguagePage() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected]   = useState<Language>(DEFAULT_LANGUAGE);
  const [query,    setQuery]       = useState('');

  useEffect(() => {
    getStoredLanguage().then(setSelected);
  }, []);

  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = async (lang: Language) => {
    setSelected(lang);
    await setStoredLanguage(lang);
    // Translation will be wired here once i18n is integrated.
    // For now just persists the preference.
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Language" />

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Language list */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Squircle
          cornerRadius={22}
          cornerSmoothing={1}
          fillColor={colors.surface}
          strokeColor={colors.border}
          strokeWidth={1}
          style={styles.card}
        >
          {filtered.map((lang, idx) => {
            const isSelected  = lang.code === selected.code;
            const isAvailable = lang.code === 'en';
            const isLast      = idx === filtered.length - 1;

            return (
              <Pressable
                key={lang.code}
                onPress={() => isAvailable && handleSelect(lang)}
                style={({ pressed }) => [
                  styles.row,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  !isAvailable && { opacity: 0.45 },
                  pressed && isAvailable && { opacity: 0.6 },
                ]}
              >
                {/* Flag */}
                <Text style={styles.flag}>{lang.flag}</Text>

                {/* Names */}
                <View style={styles.nameWrap}>
                  <Text style={[styles.langName, { color: colors.text }]}>{lang.name}</Text>
                  <Text
                    style={[
                      styles.nativeName,
                      { color: colors.textSecondary },
                      lang.rtl && styles.rtlText,
                    ]}
                  >
                    {lang.nativeName}
                  </Text>
                </View>

                {/* Checkmark or Coming Soon */}
                {isAvailable ? (
                  isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.text} />
                  )
                ) : (
                  <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>
                    Coming soon
                  </Text>
                )}
              </Pressable>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No languages found for "{query}"
              </Text>
            </View>
          )}
        </Squircle>

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          App translation coming soon. Your selection will take effect once translation is available.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    marginHorizontal: 20,
    marginTop:      16,
    marginBottom:   12,
    borderRadius:   14,
    borderWidth:    StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical:   10,
  },
  searchInput: {
    flex:       1,
    fontSize:   15,
    fontFamily: 'ProductSans-Regular',
    padding:    0,
  },
  list: {
    paddingHorizontal: 20,
    gap: 0,
  },
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:  14,
    paddingHorizontal: 16,
    gap: 14,
  },
  flag: {
    fontSize: 26,
    lineHeight: 32,
    width: 36,
    textAlign: 'center',
  },
  nameWrap: {
    flex: 1,
    gap: 2,
  },
  langName: {
    fontSize:   15,
    fontFamily: 'ProductSans-Bold',
  },
  nativeName: {
    fontSize:   13,
    fontFamily: 'ProductSans-Regular',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  empty: {
    paddingVertical:   28,
    alignItems:        'center',
  },
  emptyText: {
    fontSize:   14,
    fontFamily: 'ProductSans-Regular',
  },
  comingSoon: {
    fontSize:   11,
    fontFamily: 'ProductSans-Regular',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  footer: {
    fontSize:   12,
    fontFamily: 'ProductSans-Regular',
    textAlign:  'center',
    marginTop:  16,
    lineHeight: 18,
  },
});
