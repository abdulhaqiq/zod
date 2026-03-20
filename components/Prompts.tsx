import { navPush, navReplace } from '@/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

const MAX_PROMPTS = 2;
const MAX_CHARS   = 150;

const PROMPT_TEMPLATES = [
  "Don't be mad if I…",
  "Two truths and a lie…",
  "The way to win me over is…",
  "We'll get along if you…",
  "My most controversial opinion is…",
  "I go crazy for…",
  "My love language is…",
  "I'm currently obsessed with…",
  "Unpopular opinion…",
  "My ideal Sunday looks like…",
  "Change my mind about…",
  "The key to my heart is…",
  "Ask me about…",
  "I quote too much from…",
  "Together we could…",
  "My biggest green flag is…",
  "Catch flights or catch feelings?",
  "I know the best spot in town for…",
];

interface PromptEntry {
  template: string;
  answer: string;
}

export default function Prompts() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [prompts,      setPrompts]      = useState<(PromptEntry | null)[]>([null, null]);
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [editingSlot,  setEditingSlot]  = useState<number | null>(null);
  const [answerOpen,   setAnswerOpen]   = useState(false);
  const [draftTemplate, setDraftTemplate] = useState('');
  const [draftAnswer,   setDraftAnswer]   = useState('');
  const [touched,      setTouched]      = useState(false);

  const filledCount = prompts.filter(Boolean).length;

  const openPicker = (slot: number) => {
    setEditingSlot(slot);
    setPickerOpen(true);
  };

  const selectTemplate = (tpl: string) => {
    setDraftTemplate(tpl);
    const existing = editingSlot !== null ? prompts[editingSlot] : null;
    setDraftAnswer(existing?.template === tpl ? existing.answer : '');
    setPickerOpen(false);
    setAnswerOpen(true);
  };

  const saveAnswer = () => {
    if (editingSlot === null) return;
    const trimmed = draftAnswer.trim();
    setPrompts(prev => {
      const next = [...prev];
      next[editingSlot] = trimmed ? { template: draftTemplate, answer: trimmed } : null;
      return next;
    });
    setAnswerOpen(false);
    setDraftAnswer('');
    setDraftTemplate('');
    setEditingSlot(null);
  };

  const removePrompt = (slot: number) =>
    setPrompts(prev => { const n = [...prev]; n[slot] = null; return n; });

  const handleContinue = () => {
    setTouched(true);
    if (filledCount === 0) return;
    navPush('/photos');
  };

  const unusedTemplates = PROMPT_TEMPLATES.filter(
    t => !prompts.some(p => p?.template === t)
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
          <Text style={[styles.title, { color: colors.text }]}>Show your{'\n'}personality</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Add up to 2 prompts — they appear on your profile and start great chats.
          </Text>

          {/* Prompt slots */}
          <View style={styles.slots}>
            {prompts.map((entry, slot) => (
              <View key={slot}>
                {entry ? (
                  /* Filled card */
                  <Squircle
                    style={styles.filledCard}
                    cornerRadius={20}
                    cornerSmoothing={1}
                    fillColor={colors.surface}
                    strokeColor={colors.btnPrimaryBg}
                    strokeWidth={1.5}
                  >
                    <View style={styles.filledTop}>
                      <Text style={[styles.filledTemplate, { color: colors.btnPrimaryBg }]}>{entry.template}</Text>
                      <Pressable onPress={() => removePrompt(slot)} hitSlop={10}>
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                    <Text style={[styles.filledAnswer, { color: colors.text }]}>{entry.answer}</Text>
                    <Pressable onPress={() => openPicker(slot)} style={styles.editBtn}>
                      <Ionicons name="pencil" size={12} color={colors.textSecondary} />
                      <Text style={[styles.editBtnText, { color: colors.textSecondary }]}>Edit</Text>
                    </Pressable>
                  </Squircle>
                ) : (
                  /* Empty slot */
                  <Pressable onPress={() => openPicker(slot)} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                    <Squircle
                      style={styles.emptySlot}
                      cornerRadius={20}
                      cornerSmoothing={1}
                      fillColor={colors.surface}
                      strokeColor={colors.border}
                      strokeWidth={1.5}
                    >
                      <View style={[styles.plusCircle, { backgroundColor: `${colors.btnPrimaryBg}20` }]}>
                        <Ionicons name="add" size={22} color={colors.btnPrimaryBg} />
                      </View>
                      <Text style={[styles.emptySlotText, { color: colors.textSecondary }]}>
                        Tap to add a prompt
                      </Text>
                    </Squircle>
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {touched && filledCount === 0 && (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={13} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>Add at least one prompt</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Continue" onPress={handleContinue} style={styles.btn} />
      </View>

      {/* Template picker modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a prompt</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView>
            {unusedTemplates.map(tpl => (
              <TouchableOpacity key={tpl} onPress={() => selectTemplate(tpl)}>
                <View style={[styles.templateRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.templateText, { color: colors.text }]}>{tpl}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Answer input modal */}
      <Modal visible={answerOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => { setAnswerOpen(false); }} />
          <SafeAreaView style={[styles.sheet, styles.answerSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => { setAnswerOpen(false); setPickerOpen(true); }} hitSlop={10}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Your answer</Text>
              <Pressable onPress={() => { setAnswerOpen(false); }} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.templatePreview, { backgroundColor: `${colors.btnPrimaryBg}20` }]}>
              <Text style={[styles.templatePreviewText, { color: colors.btnPrimaryBg }]}>{draftTemplate}</Text>
            </View>

            <TextInput
              value={draftAnswer}
              onChangeText={t => setDraftAnswer(t.slice(0, MAX_CHARS))}
              placeholder="Write your answer…"
              placeholderTextColor={colors.textSecondary}
              multiline
              autoFocus
              style={[styles.answerInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            />
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {draftAnswer.length} / {MAX_CHARS}
            </Text>

            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Button
                title="Save"
                onPress={saveAnswer}
                disabled={draftAnswer.trim().length === 0}
                style={{ width: '100%' }}
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1 },
  scroll:             { flexGrow: 1 },
  topBar:             { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body:               { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  title:              { fontSize: 34, fontFamily: 'ProductSans-Black', lineHeight: 42, marginBottom: 8 },
  subtitle:           { fontSize: 14, fontFamily: 'ProductSans-Regular', lineHeight: 21, marginBottom: 28 },
  slots:              { gap: 14 },
  emptySlot:          { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 14, minHeight: 80 },
  plusCircle:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptySlotText:      { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  filledCard:         { padding: 18, gap: 8 },
  filledTop:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  filledTemplate:     { fontSize: 13, fontFamily: 'ProductSans-Bold', flex: 1, marginRight: 8 },
  filledAnswer:       { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22 },
  editBtn:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  editBtnText:        { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  errorRow:           { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  errorText:          { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  footer:             { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
  btn:                { width: '100%' },
  modalBackdrop:      { flex: 1, backgroundColor: '#00000055' },
  sheet:              { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  answerSheet:        { maxHeight: '90%' },
  sheetHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: '#999', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle:         { fontSize: 16, fontFamily: 'ProductSans-Bold' },
  templateRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  templateText:       { fontSize: 15, fontFamily: 'ProductSans-Regular', flex: 1, marginRight: 8 },
  templatePreview:    { marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 12 },
  templatePreviewText:{ fontSize: 14, fontFamily: 'ProductSans-Bold' },
  answerInput:        { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: 'ProductSans-Regular', minHeight: 100, textAlignVertical: 'top' },
  charCount:          { textAlign: 'right', marginHorizontal: 20, marginTop: 6, fontSize: 12, marginBottom: 16, fontFamily: 'ProductSans-Regular' },
});
