import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkEntry {
  id: string;
  jobTitle: string;
  company: string;
  startYear: string;
  endYear: string;
  current: boolean;
}

const MAX_ENTRIES = 3;

// ─── Field input ──────────────────────────────────────────────────────────────

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', colors,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboardType?: any; colors: AppColors;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Squircle
        style={styles.inputBox}
        cornerRadius={14}
        cornerSmoothing={1}
        fillColor={colors.surface2}
        strokeColor={colors.border}
        strokeWidth={1}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          selectionColor={colors.text}
          returnKeyType="next"
        />
      </Squircle>
    </View>
  );
}

// ─── Work Entry Card ──────────────────────────────────────────────────────────

function WorkCard({
  entry, onChange, onRemove, colors,
}: {
  entry: WorkEntry;
  onChange: (updated: WorkEntry) => void;
  onRemove: () => void;
  colors: AppColors;
}) {
  const set = (key: keyof WorkEntry) => (val: any) =>
    onChange({ ...entry, [key]: val });

  return (
    <Squircle
      style={styles.card}
      cornerRadius={22}
      cornerSmoothing={1}
      fillColor={colors.surface}
      strokeColor={colors.border}
      strokeWidth={1}
    >
      {/* Card header */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.cardHeaderLeft}>
          <Squircle style={styles.cardIcon} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="briefcase-outline" size={16} color={colors.text} />
          </Squircle>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {entry.jobTitle || 'New Experience'}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Squircle style={styles.removeBtn} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
            <Ionicons name="trash-outline" size={14} color={colors.error ?? '#FF3B30'} />
          </Squircle>
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Field label="Job Title" value={entry.jobTitle} onChangeText={set('jobTitle')}
          placeholder="e.g. UX Designer" colors={colors} />
        <Field label="Company" value={entry.company} onChangeText={set('company')}
          placeholder="e.g. Adobe" colors={colors} />

        <View style={styles.yearRow}>
          <View style={{ flex: 1 }}>
            <Field label="Start Year" value={entry.startYear} onChangeText={set('startYear')}
              placeholder="2020" keyboardType="numeric" colors={colors} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="End Year"
              value={entry.current ? 'Present' : entry.endYear}
              onChangeText={set('endYear')}
              placeholder="2023"
              keyboardType="numeric"
              colors={colors}
            />
          </View>
        </View>

        {/* Current role toggle */}
        <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Current role</Text>
          <Switch
            value={entry.current}
            onValueChange={set('current')}
            thumbColor={colors.bg}
            trackColor={{ false: colors.surface2, true: colors.text }}
          />
        </View>
      </View>
    </Squircle>
  );
}

// ─── Work Experience Page ─────────────────────────────────────────────────────

export default function WorkExperiencePage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [linkedIn, setLinkedIn] = useState(false);

  const [entries, setEntries] = useState<WorkEntry[]>([
    { id: '1', jobTitle: 'UX Designer', company: 'Adobe', startYear: '2021', endYear: '', current: true },
  ]);

  const addEntry = () => {
    if (entries.length >= MAX_ENTRIES) return;
    setEntries(prev => [...prev, {
      id: Date.now().toString(),
      jobTitle: '', company: '', startYear: '', endYear: '', current: false,
    }]);
  };

  const updateEntry = (id: string, updated: WorkEntry) =>
    setEntries(prev => prev.map(e => e.id === id ? updated : e));

  const removeEntry = (id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id));

  const handleSave = () => {
    Alert.alert('Saved', 'Work experience updated.');
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Work Experience"
          onClose={() => router.back()}
          rightLabel="Save"
          onRightPress={handleSave}
          colors={colors}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* LinkedIn import banner */}
          <Squircle
            style={styles.linkedInBanner}
            cornerRadius={20}
            cornerSmoothing={1}
            fillColor="#0A66C2"
          >
            <View style={styles.linkedInInner}>
              <View style={styles.linkedInLeft}>
                <Squircle style={styles.linkedInIcon} cornerRadius={10} cornerSmoothing={1} fillColor="rgba(255,255,255,0.18)">
                  <Ionicons name="logo-linkedin" size={20} color="#fff" />
                </Squircle>
                <View>
                  <Text style={styles.linkedInTitle}>Import from LinkedIn</Text>
                  <Text style={styles.linkedInSub}>
                    {linkedIn ? 'Connected · @alexjohnson' : 'Auto-fill your experience'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.linkedInBtn, linkedIn && { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => setLinkedIn(v => !v)}
              >
                <Text style={styles.linkedInBtnText}>{linkedIn ? 'Connected' : 'Connect'}</Text>
              </Pressable>
            </View>
          </Squircle>

          {/* Entry cards */}
          {entries.map(entry => (
            <WorkCard
              key={entry.id}
              entry={entry}
              onChange={updated => updateEntry(entry.id, updated)}
              onRemove={() => removeEntry(entry.id)}
              colors={colors}
            />
          ))}

          {/* Add button */}
          {entries.length < MAX_ENTRIES && (
            <Pressable onPress={addEntry} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <Squircle
                style={styles.addBtn}
                cornerRadius={18}
                cornerSmoothing={1}
                fillColor={colors.surface}
                strokeColor={colors.border}
                strokeWidth={1.5}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.text} />
                <Text style={[styles.addBtnText, { color: colors.text }]}>
                  Add Experience
                  <Text style={{ color: colors.textSecondary }}> · {entries.length}/{MAX_ENTRIES}</Text>
                </Text>
              </Squircle>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  flex:             { flex: 1 },
  scroll:           { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 14 },

  // LinkedIn
  linkedInBanner:   { overflow: 'hidden' },
  linkedInInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 10 },
  linkedInLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  linkedInIcon:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  linkedInTitle:    { fontSize: 14, fontFamily: 'ProductSans-Bold', color: '#fff' },
  linkedInSub:      { fontSize: 11, fontFamily: 'ProductSans-Regular', color: 'rgba(255,255,255,0.7)' },
  linkedInBtn:      { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  linkedInBtnText:  { fontSize: 12, fontFamily: 'ProductSans-Bold', color: '#0A66C2' },

  // Card
  card:             { overflow: 'hidden' },
  cardHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  cardHeaderLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardIcon:         { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cardTitle:        { fontSize: 14, fontFamily: 'ProductSans-Bold', flex: 1 },
  removeBtn:        { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  cardBody:         { padding: 14, gap: 12 },

  // Field
  fieldWrap:        { gap: 5 },
  fieldLabel:       { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 0.5 },
  inputBox:         { height: 46, paddingHorizontal: 14 },
  input:            { flex: 1, fontSize: 15, fontFamily: 'ProductSans-Regular' },

  yearRow:          { flexDirection: 'row', gap: 10 },

  // Toggle
  toggleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  toggleLabel:      { fontSize: 14, fontFamily: 'ProductSans-Regular' },

  // Add button
  addBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  addBtnText:       { fontSize: 15, fontFamily: 'ProductSans-Bold' },
});
