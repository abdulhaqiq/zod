import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';import ChipSelectorSheet, { type ChipOption } from '@/components/ui/ChipSelectorSheet';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { apiFetch, API_V1 } from '@/constants/api';
import { getLookupLabel, LOOKUP } from '@/constants/lookupData';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import type { AppColors } from '@/constants/appColors';

const { width: W } = Dimensions.get('window');
const GRID_PADDING = 12;
const GRID_GAP = 8;
const SLOT_SIZE = (W - 32 - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

// ─── Chip data (from shared LOOKUP — IDs match DB lookup_options rows) ────────

const INTERESTS: ChipOption[] = LOOKUP.interests.map(r => ({ value: String(r.id), emoji: r.emoji, label: r.label }));
const CAUSES: ChipOption[]    = LOOKUP.causes.map(r => ({ value: String(r.id), emoji: r.emoji, label: r.label }));
const QUALITIES: ChipOption[] = LOOKUP.values_list.map(r => ({ value: String(r.id), emoji: r.emoji, label: r.label }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: AppColors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>
  );
}

function Group({ children, colors }: { children: React.ReactNode; colors: AppColors }) {
  return (
    <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
      fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
      {children}
    </Squircle>
  );
}

function EditRow({
  icon, label, value, preview, onPress, colors, accentIcon = false, last = false, locked = false,
}: {
  icon: any; label: string; value?: string; preview?: string; onPress?: () => void;
  colors: AppColors; accentIcon?: boolean; last?: boolean; locked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.editRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && !locked && { opacity: 0.65 },
        locked && { opacity: 0.55 },
      ]}
    >
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1}
        fillColor={accentIcon ? '#833ab4' : colors.surface2}>
        <Ionicons name={icon} size={16} color={accentIcon ? '#fff' : colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.editPreview, { color: colors.textSecondary }]} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.editValue, { color: colors.textSecondary }]}>{value}</Text> : null}
      {locked
        ? <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
        : <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
      }
    </Pressable>
  );
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────

function PhotoGrid({
  photos, onPhotosChange, colors,
}: {
  photos: (string | null)[];
  onPhotosChange: (next: (string | null)[]) => void;
  colors: AppColors;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const { token } = useAuth();

  const pickPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(index);
    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      } as any);

      const res = await fetch(`${API_V1}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Photo Rejected', (err as any).detail ?? 'Upload failed. Please try again.');
        return;
      }

      const data = await res.json() as { url: string };
      const next = [...photos];
      next[index] = data.url;
      onPhotosChange(next);
    } catch {
      Alert.alert('Upload Failed', 'Please check your connection and try again.');
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = (index: number) => {
    Alert.alert('Remove Photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          const next = [...photos];
          next[index] = null;
          onPhotosChange(next);
        },
      },
    ]);
  };

  return (
    <View style={styles.photoGrid}>
      {photos.map((uri, i) => (
        <Pressable
          key={i}
          onPress={() => uploading === null && (uri ? removePhoto(i) : pickPhoto(i))}
          style={({ pressed }) => [
            styles.photoSlot,
            { backgroundColor: colors.surface2, borderColor: colors.border },
            pressed && { opacity: 0.75 },
          ]}
        >
          {uploading === i ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : uri ? (
            <>
              <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
              <Pressable style={styles.photoRemoveBtn} onPress={() => removePhoto(i)} hitSlop={4}>
                <View style={styles.photoRemoveBg}>
                  <Ionicons name="close" size={12} color="#fff" />
                </View>
              </Pressable>
            </>
          ) : (
            <Ionicons name="add" size={24} color={colors.textTertiary} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Best Photo Row (with Switch) ─────────────────────────────────────────────

function BestPhotoRow({
  colors, token, photos, initialEnabled, onPhotosReordered,
}: {
  colors: AppColors;
  token: string | null;
  photos: (string | null)[];
  initialEnabled: boolean;
  onPhotosReordered: (urls: string[]) => void;
}) {
  const [enabled,  setEnabled]  = useState(initialEnabled);
  const [loading,  setLoading]  = useState(false);
  const [subtitle, setSubtitle] = useState(
    initialEnabled ? 'AI-selected · best photo is first' : 'Highlight your favourite shot'
  );

  const handleToggle = async (val: boolean) => {
    if (!val) {
      // Turning OFF — just persist the flag
      setEnabled(false);
      setSubtitle('Highlight your favourite shot');
      try {
        await apiFetch<any>('/profile/me', {
          method: 'PATCH',
          token: token ?? undefined,
          body: JSON.stringify({ best_photo_enabled: false }),
        });
      } catch { /* silently ignore */ }
      return;
    }

    const filled = photos.filter((u): u is string => !!u);
    if (filled.length < 2) {
      setSubtitle('Upload more photos to use this feature');
      return;
    }

    setEnabled(true);
    setLoading(true);
    setSubtitle('Analysing photos…');
    try {
      // POST reorders photos AND sets best_photo_enabled = true in DB
      const updated = await apiFetch<any>('/profile/me/best-photo', {
        method: 'POST',
        token: token ?? undefined,
      });
      const reordered: string[] = updated.photos ?? filled;
      onPhotosReordered(reordered);
      setSubtitle('AI-selected · best photo is first');
    } catch {
      setSubtitle('Could not analyse photos — try again');
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[
      styles.editRow,
      { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        {loading
          ? <ActivityIndicator size="small" color={colors.text} />
          : <Ionicons name={enabled ? 'star' : 'star-outline'} size={16} color={enabled ? '#FFD60A' : colors.text} />
        }
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>Best Photo</Text>
        <Text style={[styles.editPreview, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={handleToggle}
        disabled={loading}
        thumbColor={colors.bg}
        trackColor={{ false: colors.surface2, true: colors.text }}
      />
    </View>
  );
}

// ─── Chip Edit Row ────────────────────────────────────────────────────────────

function ChipEditRow({
  icon, label, selected, onPress, colors, last = false,
}: {
  icon: any; label: string; selected: string[]; onPress: () => void;
  colors: AppColors; last?: boolean;
}) {
  const preview = selected.length > 0
    ? selected.slice(0, 3).join(' · ') + (selected.length > 3 ? ` +${selected.length - 3}` : '')
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.editRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Squircle style={styles.editIconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.surface2}>
        <Ionicons name={icon} size={16} color={colors.text} />
      </Squircle>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.editLabel, { color: colors.text }]}>{label}</Text>
        {preview ? (
          <Text style={[styles.editPreview, { color: colors.textSecondary }]} numberOfLines={1}>{preview}</Text>
        ) : (
          <Text style={[styles.editPreview, { color: colors.textTertiary }]}>Tap to select</Text>
        )}
      </View>
      {selected.length > 0 && (
        <View style={[styles.chipCountBadge, { backgroundColor: colors.surface2 }]}>
          <Text style={[styles.chipCountText, { color: colors.text }]}>{selected.length}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─── Edit Profile Page ────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();

  // ── Email inline edit ─────────────────────────────────────────────────────
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(profile?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailFormatValid = EMAIL_REGEX.test(emailDraft.trim());
  const emailUnchanged = emailDraft.trim().toLowerCase() === (profile?.email ?? '').toLowerCase();

  const handleEmailChange = (text: string) => {
    setEmailDraft(text);
    setEmailError(null);
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    if (!EMAIL_REGEX.test(text.trim()) || text.trim().toLowerCase() === (profile?.email ?? '').toLowerCase()) return;
    setCheckingEmail(true);
    emailDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_V1}/profile/check-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: text.trim() }),
        });
        const data = await res.json();
        if (!data.available) setEmailError('This email is already in use.');
      } catch { /* allow — backend will catch */ }
      finally { setCheckingEmail(false); }
    }, 600);
  };

  const handleEmailSave = async () => {
    if (!emailFormatValid || emailError || checkingEmail) return;
    setSavingEmail(true);
    try {
      const updated = await apiFetch<any>('/profile/me', {
        method: 'PATCH',
        token: token ?? undefined,
        body: JSON.stringify({ email: emailDraft.trim().toLowerCase() }),
      });
      updateProfile(updated);
      setEditingEmail(false);
    } catch (e: any) {
      setEmailError(e?.detail ?? 'Could not save email. Please try again.');
    } finally {
      setSavingEmail(false);
    }
  };

  // ── Photos ───────────────────────────────────────────────────────────────
  const buildPhotoSlots = (urls: string[] | null): (string | null)[] => {
    const filled = (urls ?? []).slice(0, 6);
    const slots: (string | null)[] = [...filled];
    while (slots.length < 6) slots.push(null);
    return slots;
  };

  const [photos, setPhotos] = useState<(string | null)[]>(() =>
    buildPhotoSlots(profile?.photos ?? null)
  );

  // ── Bio ──────────────────────────────────────────────────────────────────
  const [bio, setBio] = useState(profile?.bio ?? '');
  const MAX_BIO = 300;

  // ── Chip selections (stored as string ID keys matching ChipOption.value) ──
  const [interests, setInterests]   = useState<string[]>((profile?.interests ?? []).map(String));
  const [causes, setCauses]         = useState<string[]>((profile?.causes ?? []).map(String));
  const [qualities, setQualities]   = useState<string[]>((profile?.values_list ?? []).map(String));

  const [showInterests, setShowInterests]   = useState(false);
  const [showCauses, setShowCauses]         = useState(false);
  const [showQualities, setShowQualities]   = useState(false);

  const [saving, setSaving] = useState(false);

  // Patch helper
  const patch = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const updated = await apiFetch<any>('/profile/me', {
        method: 'PATCH',
        token: token ?? undefined,
        body: JSON.stringify(payload),
      });
      updateProfile(updated);
    } catch {
      // silently fail — local state still updated
    }
  }, [token, updateProfile]);

  // Auto-save photos whenever the slots change
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    const urls = photos.filter((u): u is string => !!u);
    patch({ photos: urls });
  }, [photos]);

  // Auto-save chip arrays on close — convert string IDs back to numbers for backend
  const saveInterests = useCallback((vals: string[]) => {
    setInterests(vals);
    setShowInterests(false);
    patch({ interests: vals.map(Number) });
  }, [patch]);

  const saveCauses = useCallback((vals: string[]) => {
    setCauses(vals);
    setShowCauses(false);
    patch({ causes: vals.map(Number) });
  }, [patch]);

  const saveQualities = useCallback((vals: string[]) => {
    setQualities(vals);
    setShowQualities(false);
    patch({ values_list: vals.map(Number) });
  }, [patch]);

  // ── Derived display values ────────────────────────────────────────────────
  const workLabel = (() => {
    const we = profile?.work_experience;
    if (!we?.length) return undefined;
    const latest = we[0];
    const parts = [latest.job_title, latest.company].filter(Boolean);
    return parts.join(' · ') || undefined;
  })();

  const eduLabel = (() => {
    const ed = profile?.education;
    if (!ed?.length) return undefined;
    const latest = ed[0];
    const parts = [latest.institution, latest.course].filter(Boolean);
    return parts.join(' – ') || undefined;
  })();

  const handleSave = async () => {
    setSaving(true);
    await patch({ bio: bio.trim() || null });
    setSaving(false);
    router.back();
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title="Edit Profile"
          onClose={() => router.back()}
          colors={colors}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── PHOTOS ──────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="PHOTOS" colors={colors} />
            <Group colors={colors}>
              <View style={styles.photosInner}>
                <PhotoGrid photos={photos} onPhotosChange={setPhotos} colors={colors} />
              </View>
            </Group>
          </View>

          {/* ── MEDIA ──────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="MEDIA" colors={colors} />
            <Group colors={colors}>
              <BestPhotoRow
                colors={colors}
                token={token}
                photos={photos}
                initialEnabled={profile?.best_photo_enabled ?? false}
                onPhotosReordered={(urls) => {
                  const slots: (string | null)[] = [...urls];
                  while (slots.length < 6) slots.push(null);
                  setPhotos(slots);
                }}
              />
              <EditRow
                icon="checkmark-circle-outline"
                label="Verification"
                value="Get Verified"
                onPress={() => router.push('/verification')}
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── PERSONALITY ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="PERSONALITY" colors={colors} />
            <Group colors={colors}>
              <ChipEditRow
                icon="heart-outline"
                label="Interests"
                selected={interests}
                onPress={() => setShowInterests(true)}
                colors={colors}
              />
              <ChipEditRow
                icon="globe-outline"
                label="Causes & Communities"
                selected={causes}
                onPress={() => setShowCauses(true)}
                colors={colors}
              />
              <ChipEditRow
                icon="diamond-outline"
                label="Qualities I Value"
                selected={qualities}
                onPress={() => setShowQualities(true)}
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── BIO ─────────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="BIO" colors={colors} />
            <View style={styles.bioWrap}>
              <Squircle
                style={styles.bioBox}
                cornerRadius={18} cornerSmoothing={1}
                fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1.5}
              >
                <TextInput
                  style={[styles.bioInput, { color: colors.text }]}
                  placeholder="Write something about yourself…"
                  placeholderTextColor={colors.placeholder}
                  value={bio}
                  onChangeText={t => setBio(t.slice(0, MAX_BIO))}
                  multiline maxLength={MAX_BIO}
                  selectionColor={colors.text}
                />
              </Squircle>
              <Text style={[styles.bioCount, { color: colors.textTertiary }]}>
                {bio.length}/{MAX_BIO}
              </Text>
            </View>
          </View>

          {/* ── IDENTITY ────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="IDENTITY" colors={colors} />
            <Group colors={colors}>
              <EditRow
                icon="person-outline"
                label="Gender"
                value={getLookupLabel('gender', profile?.gender_id ?? null) || undefined}
                colors={colors}
                locked
                last
              />
            </Group>
          </View>

          {/* ── ACCOUNT ─────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="ACCOUNT" colors={colors} />
            <Group colors={colors}>
              {editingEmail ? (
                <View style={[styles.editRow, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                  <Text style={[styles.editLabel, { color: colors.text }]}>Email address</Text>
                  <Squircle
                    style={{ height: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
                    cornerRadius={14} cornerSmoothing={1}
                    fillColor={colors.surface2}
                    strokeColor={emailError ? '#ef4444' : emailFormatValid ? colors.borderActive : colors.border}
                    strokeWidth={emailFormatValid || emailError ? 2 : 1.5}
                  >
                    <TextInput
                      style={[styles.editLabel, { color: colors.text, flex: 1 }]}
                      value={emailDraft}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleEmailSave}
                      placeholderTextColor={colors.placeholder}
                      placeholder="your@email.com"
                    />
                    {checkingEmail && <ActivityIndicator size="small" color={colors.textSecondary} />}
                  </Squircle>
                  {emailError ? (
                    <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: '#ef4444' }}>
                      {emailError}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => { setEditingEmail(false); setEmailDraft(profile?.email ?? ''); setEmailError(null); }}
                      style={({ pressed }) => [styles.emailBtn, { backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={[styles.emailBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleEmailSave}
                      disabled={!emailFormatValid || !!emailError || checkingEmail || emailUnchanged || savingEmail}
                      style={({ pressed }) => [
                        styles.emailBtn,
                        { flex: 1, backgroundColor: colors.text, opacity: (!emailFormatValid || !!emailError || checkingEmail || emailUnchanged || savingEmail) ? 0.4 : pressed ? 0.8 : 1 },
                      ]}
                    >
                      {savingEmail
                        ? <ActivityIndicator size="small" color={colors.bg} />
                        : <Text style={[styles.emailBtnText, { color: colors.bg }]}>Save</Text>
                      }
                    </Pressable>
                  </View>
                </View>
              ) : (
                <EditRow
                  icon="mail-outline"
                  label="Email"
                  value={profile?.email ?? undefined}
                  preview={profile?.email ? undefined : 'Tap to add'}
                  onPress={() => { setEmailDraft(profile?.email ?? ''); setEmailError(null); setEditingEmail(true); }}
                  colors={colors}
                  last
                />
              )}
            </Group>
          </View>

          {/* ── WORK & EDUCATION ────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="WORK & EDUCATION" colors={colors} />
            <Group colors={colors}>
              <EditRow
                icon="briefcase-outline"
                label="Work"
                value={workLabel}
                preview={workLabel ? undefined : 'Tap to add'}
                onPress={() => router.push('/work-experience')}
                colors={colors}
              />
              <EditRow
                icon="school-outline"
                label="Education"
                value={eduLabel}
                preview={eduLabel ? undefined : 'Tap to add'}
                onPress={() => router.push('/education')}
                colors={colors}
                last
              />
            </Group>
          </View>

          {/* ── LOCATION ────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <SectionLabel title="LOCATION" colors={colors} />
            <Group colors={colors}>
              <EditRow
                icon="location-outline"
                label="Living Now"
                value={profile?.city ?? undefined}
                preview={profile?.city ? undefined : 'Tap to set'}
                onPress={() => router.push('/location-search?type=living')}
                colors={colors}
              />
              <EditRow
                icon="home-outline"
                label="Hometown"
                value={profile?.hometown ?? undefined}
                preview={profile?.hometown ? undefined : 'Tap to set'}
                onPress={() => router.push('/location-search?type=hometown')}
                colors={colors}
                last
              />
            </Group>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Chip selector sheets ─────────────────────────────────────────── */}
      <ChipSelectorSheet
        visible={showInterests}
        onClose={() => setShowInterests(false)}
        title="Interests"
        subtitle="Pick up to 5 things you love"
        maxSelect={5}
        options={INTERESTS}
        selected={interests}
        onChange={saveInterests}
        colors={colors}
      />
      <ChipSelectorSheet
        visible={showCauses}
        onClose={() => setShowCauses(false)}
        title="Causes & Communities"
        subtitle="What causes matter to you?"
        maxSelect={6}
        options={CAUSES}
        selected={causes}
        onChange={saveCauses}
        colors={colors}
      />
      <ChipSelectorSheet
        visible={showQualities}
        onClose={() => setShowQualities(false)}
        title="Qualities I Value"
        subtitle="Pick traits you look for in a partner"
        maxSelect={5}
        options={QUALITIES}
        selected={qualities}
        onChange={saveQualities}
        colors={colors}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  flex:         { flex: 1 },
  scroll:       { paddingBottom: 48 },

  section:      { paddingHorizontal: 16, marginTop: 22, gap: 6 },
  sectionLabel: { fontSize: 12, fontFamily: 'ProductSans-Bold', letterSpacing: 1.5, marginLeft: 2, marginBottom: 2 },

  group:        { overflow: 'hidden' },

  editRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  editIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editLabel:    { fontSize: 14, fontFamily: 'ProductSans-Regular' },
  editPreview:  { fontSize: 11, fontFamily: 'ProductSans-Regular' },
  editValue:    { fontSize: 12, fontFamily: 'ProductSans-Regular', maxWidth: 130, textAlign: 'right' },

  chipCountBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  chipCountText:  { fontSize: 11, fontFamily: 'ProductSans-Bold' },

  photosInner:    { padding: GRID_PADDING, gap: GRID_GAP },
  photoGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  photoSlot:      {
    width: SLOT_SIZE,
    height: SLOT_SIZE * 1.2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg:       { width: '100%', height: '100%' },
  photoRemoveBtn: { position: 'absolute', top: 4, right: 4 },
  photoRemoveBg:  { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },

  bioWrap:        { gap: 6 },
  bioBox:         { padding: 14, minHeight: 120 },
  bioInput:       { fontSize: 15, fontFamily: 'ProductSans-Regular', lineHeight: 22, textAlignVertical: 'top' },
  bioCount:       { fontSize: 11, fontFamily: 'ProductSans-Regular', textAlign: 'right', marginRight: 4 },

  emailBtn:       { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  emailBtnText:   { fontSize: 14, fontFamily: 'ProductSans-Bold' },
});
