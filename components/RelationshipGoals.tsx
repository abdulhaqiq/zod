import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

type Goal = 'longterm' | 'lifepartner' | 'casual' | 'intimacy' | 'marriage' | 'ethical' | null;

const GOALS = [
  { id: 'longterm'   as const, emoji: '💑', label: 'Something serious',   desc: 'I want a real, lasting relationship' },
  { id: 'lifepartner'as const, emoji: '🤝', label: 'My forever person',   desc: 'Looking for the one'                 },
  { id: 'casual'     as const, emoji: '🥂', label: 'Casual dating',       desc: 'Fun, no pressure, see where it goes' },
  { id: 'intimacy'   as const, emoji: '🔥', label: 'Something physical',  desc: 'No strings attached'                 },
  { id: 'marriage'   as const, emoji: '💍', label: 'Marriage',            desc: 'Ready to commit for life'            },
  { id: 'ethical'    as const, emoji: '🌈', label: 'Open relationship',   desc: 'Seeing multiple people, openly'      },
];

export default function RelationshipGoals() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [goal, setGoal]       = useState<Goal>(null);
  const [touched, setTouched] = useState(false);

  const error = touched && !goal ? "Please select what you're looking for" : null;

  const handleContinue = () => {
    setTouched(true);
    if (!goal) return;
    navPush('/height');
  };

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
          <Text style={[styles.title, { color: colors.text }]}>What are you{'\n'}hoping for?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Be honest — it helps us find your best match.
          </Text>

          <View style={styles.list}>
            {GOALS.map((item) => {
              const selected  = goal === item.id;
              const bgColor   = selected ? colors.btnPrimaryBg  : colors.surface;
              const fgColor   = selected ? colors.btnPrimaryText : colors.text;
              const fgSub     = selected ? `${colors.btnPrimaryText}99` : colors.textSecondary;

              return (
                <Pressable key={item.id} onPress={() => setGoal(item.id)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                  <Squircle
                    style={styles.card}
                    cornerRadius={18}
                    cornerSmoothing={1}
                    fillColor={bgColor}
                    strokeColor={selected ? bgColor : colors.border}
                    strokeWidth={selected ? 0 : 1.5}
                  >
                    <Text style={styles.emoji}>{item.emoji}</Text>
                    <View style={styles.cardText}>
                      <Text style={[styles.cardLabel, { color: fgColor }]}>{item.label}</Text>
                      <Text style={[styles.cardDesc,  { color: fgSub }]}>{item.desc}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={fgColor} />}
                  </Squircle>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={13} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Continue" onPress={handleContinue} disabled={touched && !goal} style={styles.btn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  title: { fontSize: 38, fontFamily: 'ProductSans-Black', lineHeight: 46, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 28 },
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  emoji: { fontSize: 26 },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 15, fontFamily: 'ProductSans-Bold', marginBottom: 2 },
  cardDesc: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  errorText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
});
