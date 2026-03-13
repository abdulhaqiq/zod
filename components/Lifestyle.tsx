import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
type IoniconsName = ComponentProps<typeof Ionicons>['name'];

import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

type OptionId = string | null;

interface Section<T extends string> {
  key: string;
  title: string;
  icon: IoniconsName;
  options: { id: T; label: string; emoji: string }[];
  required?: boolean;
}

const SECTIONS = [
  {
    key: 'smoking',
    title: 'Do you smoke?',
    icon: 'flame-outline' as const,
    options: [
      { id: 'never_smoke',    label: 'Never',      emoji: '🚭' },
      { id: 'socially_smoke', label: 'Socially',   emoji: '🙈' },
      { id: 'regularly_smoke',label: 'Regularly',  emoji: '🚬' },
      { id: 'skip_smoke',     label: 'Skip',       emoji: '⏭️'  },
    ],
    required: false,
  },
  {
    key: 'drinking',
    title: 'Do you drink?',
    icon: 'wine-outline' as const,
    options: [
      { id: 'never_drink',    label: 'Never',      emoji: '🥛' },
      { id: 'socially_drink', label: 'Socially',   emoji: '🥂' },
      { id: 'regularly_drink',label: 'Regularly',  emoji: '🍻' },
      { id: 'skip_drink',     label: 'Skip',       emoji: '⏭️'  },
    ],
    required: false,
  },
  {
    key: 'kids_have',
    title: 'Do you have kids?',
    icon: 'people-outline' as const,
    options: [
      { id: 'no_kids',        label: 'No',         emoji: '🙅' },
      { id: 'yes_kids',       label: 'Yes, I do',  emoji: '👨‍👧' },
      { id: 'skip_kids_have', label: 'Skip',       emoji: '⏭️'  },
    ],
    required: false,
  },
  {
    key: 'kids_want',
    title: 'Do you want kids?',
    icon: 'heart-outline' as const,
    options: [
      { id: 'want_kids',      label: 'Yes, I do',      emoji: '🥰' },
      { id: 'open_kids',      label: 'Open to it',     emoji: '🤷' },
      { id: 'dont_want_kids', label: 'No',             emoji: '🙅' },
      { id: 'skip_kids_want', label: 'Skip',           emoji: '⏭️'  },
    ],
    required: false,
  },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

export default function Lifestyle() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [answers, setAnswers] = useState<Record<SectionKey, string | null>>({
    smoking: null,
    drinking: null,
    kids_have: null,
    kids_want: null,
  });

  const pick = (section: SectionKey, id: string) =>
    setAnswers(prev => ({ ...prev, [section]: id }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Your lifestyle{'\n'}habits</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Help people know what to expect. Skip anything you prefer to keep private.
          </Text>

          {SECTIONS.map((section) => {
            const current = answers[section.key as SectionKey];
            return (
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={section.icon} size={18} color={colors.textSecondary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                </View>
                <View style={styles.optionRow}>
                  {section.options.map((opt) => {
                    const sel = current === opt.id;
                    const isSkip = opt.id.startsWith('skip_');
                    return (
                      <Pressable key={opt.id} onPress={() => pick(section.key as SectionKey, opt.id)} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                        <Squircle
                          style={styles.optionChip}
                          cornerRadius={16}
                          cornerSmoothing={0.8}
                          fillColor={sel ? (isSkip ? colors.surface : colors.btnPrimaryBg) : colors.surface}
                          strokeColor={sel ? (isSkip ? colors.textSecondary : colors.btnPrimaryBg) : colors.border}
                          strokeWidth={sel ? 0 : 1.5}
                        >
                          <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                          <Text style={[styles.optionLabel, { color: sel && !isSkip ? colors.btnPrimaryText : colors.text }]}>
                            {opt.label}
                          </Text>
                        </Squircle>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Continue" onPress={() => router.push('/values')} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  scroll:        { flexGrow: 1 },
  topBar:        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body:          { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  title:         { fontSize: 34, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 8 },
  subtitle:      { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 28 },
  section:       { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  optionRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionChip:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  optionEmoji:   { fontSize: 16 },
  optionLabel:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  footer:        { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn:           { width: '100%' },
});
