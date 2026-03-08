import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const RELIGIONS = [
  { id: 'agnostic',   label: 'Agnostic',          emoji: '🤔' },
  { id: 'atheist',    label: 'Atheist',            emoji: '🔬' },
  { id: 'buddhist',   label: 'Buddhist',           emoji: '☸️'  },
  { id: 'christian',  label: 'Christian',          emoji: '✝️'  },
  { id: 'hindu',      label: 'Hindu',              emoji: '🕉️'  },
  { id: 'jewish',     label: 'Jewish',             emoji: '✡️'  },
  { id: 'muslim',     label: 'Muslim',             emoji: '☪️'  },
  { id: 'spiritual',  label: 'Spiritual',          emoji: '✨' },
  { id: 'other_rel',  label: 'Other',              emoji: '🌍' },
  { id: 'skip_rel',   label: 'Skip',               emoji: '⏭️'  },
];

const POLITICS = [
  { id: 'liberal',     label: 'Liberal',           emoji: '🕊️'  },
  { id: 'progressive', label: 'Progressive',       emoji: '🌱' },
  { id: 'moderate',    label: 'Moderate',          emoji: '⚖️'  },
  { id: 'conservative',label: 'Conservative',      emoji: '🦅' },
  { id: 'apolitical',  label: 'Apolitical',        emoji: '🙅' },
  { id: 'skip_pol',    label: 'Skip',              emoji: '⏭️'  },
];

export default function ReligionPolitics() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [religion,  setReligion]  = useState<string | null>(null);
  const [politics,  setPolitics]  = useState<string | null>(null);

  const renderGroup = (
    title: string,
    icon: keyof typeof import('@expo/vector-icons/build/Ionicons').glyphMap,
    items: typeof RELIGIONS,
    value: string | null,
    onChange: (id: string) => void,
  ) => (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
        <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.chipRow}>
        {items.map((item) => {
          const sel   = value === item.id;
          const isSkip = item.id.startsWith('skip_');
          return (
            <Pressable key={item.id} onPress={() => onChange(item.id)} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
              <Squircle
                style={styles.chip}
                cornerRadius={20}
                cornerSmoothing={0.8}
                fillColor={sel ? (isSkip ? colors.surface : colors.btnPrimaryBg) : colors.surface}
                strokeColor={sel ? (isSkip ? colors.textSecondary : colors.btnPrimaryBg) : colors.border}
                strokeWidth={sel ? 0 : 1.5}
              >
                <Text style={styles.chipEmoji}>{item.emoji}</Text>
                <Text style={[styles.chipLabel, { color: sel && !isSkip ? colors.btnPrimaryText : colors.text }]}>
                  {item.label}
                </Text>
              </Squircle>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

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
          <Text style={[styles.title, { color: colors.text }]}>Your beliefs{'\n'}& values</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Compatibility starts here. Skip anything private.
          </Text>

          {renderGroup('Religion', 'globe-outline', RELIGIONS, religion, setReligion)}
          {renderGroup('Politics', 'flag-outline', POLITICS,  politics, setPolitics)}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Continue" onPress={() => router.push('/prompts')} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  scroll:      { flexGrow: 1 },
  topBar:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body:        { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  title:       { fontSize: 34, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 8 },
  subtitle:    { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 28 },
  group:       { marginBottom: 32 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  groupTitle:  { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chipEmoji:   { fontSize: 15 },
  chipLabel:   { fontSize: 14, fontFamily: 'ProductSans-Medium' },
  footer:      { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn:         { width: '100%' },
});
