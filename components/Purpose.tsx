import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

type Purpose = 'date' | 'friends' | 'work' | null;

const PURPOSES = [
  { id: 'date'    as const, label: 'Date',    icon: 'heart'     as const, desc: 'Find a meaningful relationship' },
  { id: 'friends' as const, label: 'Friends', icon: 'people'    as const, desc: 'Meet new people around you'     },
  { id: 'work'    as const, label: 'Work',    icon: 'briefcase' as const, desc: 'Connect with professionals'      },
];

export default function Purpose() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [purpose, setPurpose]             = useState<Purpose>(null);
  const [touched, setTouched]             = useState(false);
  const [showWorkModal, setShowWorkModal] = useState(false);

  const error = touched && !purpose ? 'Please select what brings you here' : null;

  const handleSelect = (id: Purpose) => {
    setPurpose(id);
    if (id === 'work') setShowWorkModal(true);
  };

  const handleContinue = () => {
    setTouched(true);
    if (!purpose) return;
    navPush('/goals');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Squircle style={styles.backBtn} cornerRadius={14} cornerSmoothing={1} fillColor={colors.backBtnBg}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Squircle>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>What brings{'\n'}you here?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose one — this shapes who and what we show you.
          </Text>

          <View style={styles.list}>
            {PURPOSES.map((item) => {
              const selected    = purpose === item.id;
              const bgColor     = selected ? colors.btnPrimaryBg  : colors.surface;
              const fgColor     = selected ? colors.btnPrimaryText : colors.text;
              const fgSecondary = selected ? `${colors.btnPrimaryText}99` : colors.textSecondary;
              const iconBg      = selected ? `${colors.btnPrimaryText}18` : colors.surface2;
              const iconColor   = selected ? fgColor : colors.text;

              return (
                <Pressable key={item.id} onPress={() => handleSelect(item.id)} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                  <Squircle
                    style={styles.card}
                    cornerRadius={18}
                    cornerSmoothing={1}
                    fillColor={bgColor}
                    strokeColor={selected ? bgColor : error ? colors.errorBorder : colors.border}
                    strokeWidth={selected ? 0 : 1.5}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                      <Ionicons name={item.icon} size={20} color={iconColor} />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={[styles.cardLabel, { color: fgColor }]}>{item.label}</Text>
                      <Text style={[styles.cardDesc,  { color: fgSecondary }]}>{item.desc}</Text>
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
        <Button title="Continue" onPress={handleContinue} disabled={touched && !purpose} style={styles.btn} />
      </View>

      {/* Work / LinkedIn verify modal */}
      <Modal visible={showWorkModal} transparent animationType="slide" onRequestClose={() => setShowWorkModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowWorkModal(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Squircle style={styles.sheetIcon} cornerRadius={18} cornerSmoothing={1} fillColor="#0A66C2">
            <Ionicons name="logo-linkedin" size={28} color="#fff" />
          </Squircle>

          <Text style={[styles.sheetTitle, { color: colors.text }]}>Verify your work</Text>
          <Text style={[styles.sheetBody, { color: colors.textSecondary }]}>
            Connect your LinkedIn account to verify your professional background and unlock Work mode. Your profile stays private — we only confirm your employment.
          </Text>

          <View style={styles.sheetActions}>
            <Pressable
              style={[styles.sheetSecondary, { borderColor: colors.border }]}
              onPress={() => setShowWorkModal(false)}
            >
              <Text style={[styles.sheetSecondaryText, { color: colors.textSecondary }]}>Skip for now</Text>
            </Pressable>

            <Pressable style={styles.sheetPrimary} onPress={() => setShowWorkModal(false)}>
              <Squircle style={styles.sheetPrimaryInner} cornerRadius={14} cornerSmoothing={1} fillColor="#0A66C2">
                <Ionicons name="logo-linkedin" size={16} color="#fff" />
                <Text style={styles.sheetPrimaryText}>Verify with LinkedIn</Text>
              </Squircle>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  title: { fontSize: 42, fontFamily: 'ProductSans-Black', lineHeight: 48, marginBottom: 10 },
  subtitle: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 32 },
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 16, fontFamily: 'ProductSans-Bold', marginBottom: 2 },
  cardDesc: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  errorText: { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn: { width: '100%' },
  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 24 },
  sheetIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontFamily: 'ProductSans-Black', marginBottom: 10, textAlign: 'center' },
  sheetBody: { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  sheetActions: { width: '100%', gap: 10 },
  sheetPrimary: { height: 54 },
  sheetPrimaryInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetPrimaryText: { color: '#fff', fontSize: 15, fontFamily: 'ProductSans-Bold' },
  sheetSecondary: { height: 54, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sheetSecondaryText: { fontSize: 15, fontFamily: 'ProductSans-Medium' },
});
