/**
 * AdminMarketingPage — three-tab admin surface for marketing push notifications.
 *
 *  Send      — target picker, template or custom message, send now + recent history
 *  Templates — list / create / edit multilingual templates
 *  Countries — list / toggle / edit peak hours per country-timezone entry
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { API_V1 } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Country = {
  id: number;
  name: string;
  code: string;
  region: string;
  tz_name: string;
  peak_hours: number[];
  primary_language: string;
  is_active: boolean;
};

type Template = {
  id: number;
  name: string;
  language_code: string;
  title: string;
  body: string;
  notif_type: string;
  is_active: boolean;
  created_at: string;
};

type Campaign = {
  id: number;
  name: string | null;
  template_id: number | null;
  target: string;
  target_value: string | null;
  language_code: string | null;
  status: string;
  triggered_by: string;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
};

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function TabPill({
  label, icon, active, onPress, colors,
}: { label: string; icon: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable onPress={onPress}>
      <View style={[
        styles.tabPill,
        active && { backgroundColor: colors.text },
      ]}>
        <Ionicons name={icon as any} size={13} color={active ? colors.bg : colors.textSecondary} style={{ marginRight: 5 }} />
        <Text style={[styles.tabText, { color: active ? colors.bg : colors.textSecondary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  en: '🇬🇧 English', ar: '🇸🇦 Arabic', fr: '🇫🇷 French', es: '🇪🇸 Spanish',
  pt: '🇧🇷 Portuguese', hi: '🇮🇳 Hindi', de: '🇩🇪 German', it: '🇮🇹 Italian',
  nl: '🇳🇱 Dutch', tr: '🇹🇷 Turkish', ur: '🇵🇰 Urdu', ms: '🇲🇾 Malay',
  id: '🇮🇩 Indonesian',
};

const STATUS_COLOR: Record<string, string> = {
  sent: '#22c55e', partial: '#f59e0b', failed: '#ef4444',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ─── Send Tab ─────────────────────────────────────────────────────────────────

function SendTab({ token, colors }: { token: string; colors: any }) {
  const [target, setTarget] = useState<'all' | 'country' | 'region' | 'email' | 'phone'>('email');
  const [targetValue, setTargetValue] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [langOverride, setLangOverride] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/admin/marketing/templates?active_only=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {}
  }, [token]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_V1}/admin/marketing/campaigns?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {}
    setLoadingHistory(false);
  }, [token]);

  useEffect(() => {
    loadTemplates();
    loadHistory();
  }, [loadTemplates, loadHistory]);

  const handleSend = async () => {
    if (!selectedTemplateId && !(customTitle.trim() && customBody.trim())) {
      Alert.alert('Missing content', 'Select a template or provide a custom title and body.');
      return;
    }
    if (target !== 'all' && !targetValue.trim()) {
      Alert.alert('Missing target', `Enter a value for target "${target}".`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_V1}/admin/marketing/campaigns/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target,
          target_value: target !== 'all' ? targetValue.trim() : undefined,
          template_id: selectedTemplateId || undefined,
          custom_title: !selectedTemplateId && customTitle.trim() ? customTitle.trim() : undefined,
          custom_body:  !selectedTemplateId && customBody.trim()  ? customBody.trim()  : undefined,
          language_override: langOverride.trim() || undefined,
          campaign_name: campaignName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Sent!', `✓ ${data.sent} delivered · ${data.failed} failed`);
        setCustomTitle(''); setCustomBody(''); setCampaignName(''); setTargetValue('');
        loadHistory();
      } else {
        Alert.alert('Error', data.detail ?? 'Send failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Network error');
    } finally {
      setSending(false);
    }
  };

  const TARGET_OPTIONS: Array<{ key: typeof target; label: string; icon: string }> = [
    { key: 'email',   label: 'User (email)',  icon: 'mail-outline' },
    { key: 'phone',   label: 'User (phone)',  icon: 'call-outline' },
    { key: 'country', label: 'Country code',  icon: 'flag-outline' },
    { key: 'region',  label: 'Region',        icon: 'earth-outline' },
    { key: 'all',     label: 'Everyone',      icon: 'people-outline' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>

      {/* Campaign name (optional) */}
      <Squircle style={styles.card} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
        <Text style={[styles.secLabel, { color: colors.textSecondary }]}>CAMPAIGN NAME (OPTIONAL)</Text>
        <TextInput
          value={campaignName}
          onChangeText={setCampaignName}
          placeholder="e.g. Ramadan promo"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
      </Squircle>

      {/* Target */}
      <Squircle style={styles.card} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
        <Text style={[styles.secLabel, { color: colors.textSecondary }]}>TARGET</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {TARGET_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setTarget(opt.key)}>
              <View style={[styles.chip, { backgroundColor: target === opt.key ? colors.text : colors.surface2, borderColor: colors.border }]}>
                <Ionicons name={opt.icon as any} size={11} color={target === opt.key ? colors.bg : colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.chipText, { color: target === opt.key ? colors.bg : colors.text }]}>{opt.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {target !== 'all' && (
          <TextInput
            value={targetValue}
            onChangeText={setTargetValue}
            placeholder={
              target === 'email'   ? 'user@example.com' :
              target === 'phone'   ? '+1234567890' :
              target === 'country' ? 'SA, AE, IN, US…' :
                                     'GCC, Europe, MENA…'
            }
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, borderColor: colors.border, marginTop: 10 }]}
            autoCapitalize="none"
            keyboardType={target === 'email' ? 'email-address' : 'default'}
          />
        )}
      </Squircle>

      {/* Template picker */}
      <Squircle style={styles.card} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
        <Text style={[styles.secLabel, { color: colors.textSecondary }]}>TEMPLATE</Text>
        <Pressable
          onPress={() => setShowTemplatePicker(true)}
          style={[styles.selectBtn, { borderColor: colors.border, marginTop: 10 }]}
        >
          <Text style={{ color: selectedTemplate ? colors.text : colors.textTertiary, flex: 1, fontFamily: 'ProductSans-Regular', fontSize: 14 }}>
            {selectedTemplate
              ? `${LANG_LABELS[selectedTemplate.language_code] ?? selectedTemplate.language_code} — ${selectedTemplate.name}`
              : 'Select a template…'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </Pressable>
        {selectedTemplate && (
          <View style={{ marginTop: 10, gap: 4 }}>
            <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>{selectedTemplate.title}</Text>
            <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }}>{selectedTemplate.body}</Text>
          </View>
        )}
        {selectedTemplateId && (
          <Pressable onPress={() => setSelectedTemplateId(null)} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: '#ef4444', fontFamily: 'ProductSans-Regular' }}>Clear template</Text>
          </Pressable>
        )}
      </Squircle>

      {/* Custom title/body (only when no template selected) */}
      {!selectedTemplateId && (
        <Squircle style={styles.card} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
          <Text style={[styles.secLabel, { color: colors.textSecondary }]}>CUSTOM MESSAGE</Text>
          <TextInput
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder="Notification title"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, borderColor: colors.border, marginTop: 10 }]}
          />
          <TextInput
            value={customBody}
            onChangeText={setCustomBody}
            placeholder="Notification body"
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 70, marginTop: 8 }]}
          />
        </Squircle>
      )}

      {/* Language override */}
      <Squircle style={styles.card} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
        <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LANGUAGE OVERRIDE (OPTIONAL)</Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'ProductSans-Regular', marginTop: 4 }}>
          Leave blank to auto-detect per user. Enter a code to force all recipients to use one language.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {Object.entries(LANG_LABELS).map(([code, label]) => (
            <Pressable key={code} onPress={() => setLangOverride(langOverride === code ? '' : code)}>
              <View style={[styles.chip, { backgroundColor: langOverride === code ? colors.text : colors.surface2, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: langOverride === code ? colors.bg : colors.text }]}>{label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Squircle>

      {/* Send button */}
      <Squircle cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} style={{ height: 52 }}>
        <Pressable onPress={handleSend} disabled={sending} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          {sending
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Ionicons name="send" size={16} color={colors.bg} />}
          <Text style={{ fontSize: 15, fontFamily: 'ProductSans-Bold', color: colors.bg }}>
            {sending ? 'Sending…' : 'Send Now'}
          </Text>
        </Pressable>
      </Squircle>

      {/* Recent sends */}
      <Text style={[styles.secLabel, { color: colors.textSecondary, marginTop: 8 }]}>RECENT SENDS</Text>
      {loadingHistory
        ? <ActivityIndicator color={colors.textSecondary} style={{ marginTop: 12 }} />
        : campaigns.length === 0
          ? <Text style={{ fontSize: 13, color: colors.textTertiary, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 8 }}>No campaigns yet</Text>
          : campaigns.map(c => (
            <Squircle key={c.id} style={[styles.card, { gap: 6 }]} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text, flex: 1 }} numberOfLines={1}>
                  {c.name ?? `Campaign #${c.id}`}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[c.status] ?? '#6366f1' }]}>
                  <Text style={styles.statusText}>{c.status}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'ProductSans-Regular' }}>
                {c.triggered_by === 'scheduler' ? '⏰ Scheduler' : '👤 Admin'} · {c.target}{c.target_value ? ` / ${c.target_value}` : ''} · {c.language_code ?? 'auto'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'ProductSans-Regular' }}>
                ✓ {c.sent_count} sent · ✗ {c.failed_count} failed · {fmtDate(c.sent_at)}
              </Text>
            </Squircle>
          ))
      }

      {/* Template picker modal */}
      <Modal visible={showTemplatePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTemplatePicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, fontFamily: 'ProductSans-Bold', color: colors.text }}>Select Template</Text>
            <Pressable onPress={() => setShowTemplatePicker(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {Object.entries(groupBy(templates, t => t.language_code)).map(([lang, tmpls]) => (
              <View key={lang}>
                <Text style={[styles.secLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                  {LANG_LABELS[lang] ?? lang.toUpperCase()}
                </Text>
                {tmpls.map(t => (
                  <Pressable key={t.id} onPress={() => { setSelectedTemplateId(t.id); setShowTemplatePicker(false); }} style={{ marginBottom: 8 }}>
                    <Squircle style={{ padding: 14, gap: 4 }} cornerRadius={16} cornerSmoothing={1}
                      fillColor={selectedTemplateId === t.id ? colors.text : colors.surface}
                      strokeColor={selectedTemplateId === t.id ? colors.text : colors.border}
                      strokeWidth={1}>
                      <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: selectedTemplateId === t.id ? colors.bg : colors.text }}>{t.name}</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: selectedTemplateId === t.id ? colors.bg : colors.textSecondary }} numberOfLines={2}>{t.title} — {t.body}</Text>
                    </Squircle>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab({ token, colors }: { token: string; colors: any }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);

  // Form state
  const [fName, setFName] = useState('');
  const [fLang, setFLang] = useState('en');
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fType, setFType] = useState<'promotions' | 'dating_tips'>('promotions');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API_V1}/admin/marketing/templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setTemplates(d.templates || []); }
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditTarget(null); setFName(''); setFLang('en'); setFTitle(''); setFBody(''); setFType('promotions');
    setShowForm(true);
  };
  const openEdit = (t: Template) => {
    setEditTarget(t); setFName(t.name); setFLang(t.language_code);
    setFTitle(t.title); setFBody(t.body); setFType(t.notif_type as any);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!fName.trim() || !fTitle.trim() || !fBody.trim()) {
      Alert.alert('Required', 'Name, title, and body are required.'); return;
    }
    setSaving(true);
    try {
      const url = editTarget
        ? `${API_V1}/admin/marketing/templates/${editTarget.id}`
        : `${API_V1}/admin/marketing/templates`;
      const res = await fetch(url, {
        method: editTarget ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: fName.trim(), language_code: fLang, title: fTitle.trim(), body: fBody.trim(), notif_type: fType, is_active: true }),
      });
      if (res.ok) { setShowForm(false); load(); }
      else { const d = await res.json(); Alert.alert('Error', d.detail ?? 'Save failed'); }
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  const toggleActive = async (t: Template) => {
    try {
      await fetch(`${API_V1}/admin/marketing/templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !t.is_active }),
      });
      load();
    } catch {}
  };

  const grouped = groupBy(templates, t => t.language_code);

  if (loading) return <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text} />}
    >
      {/* New template button */}
      <Pressable onPress={openNew}>
        <Squircle style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]} cornerRadius={18} cornerSmoothing={1} fillColor={colors.text} strokeColor={colors.text} strokeWidth={0}>
          <Ionicons name="add-circle-outline" size={18} color={colors.bg} />
          <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Bold', color: colors.bg }}>New Template</Text>
        </Squircle>
      </Pressable>

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([lang, tmpls]) => (
        <View key={lang}>
          <Text style={[styles.secLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
            {LANG_LABELS[lang] ?? lang.toUpperCase()} ({tmpls.length})
          </Text>
          {tmpls.map(t => (
            <Squircle key={t.id} style={[styles.card, { gap: 8, opacity: t.is_active ? 1 : 0.5 }]} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>{t.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'ProductSans-Regular' }}>
                    {t.notif_type === 'dating_tips' ? '💡 Dating tip' : '📢 Promo'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Switch
                    value={t.is_active}
                    onValueChange={() => toggleActive(t)}
                    thumbColor={colors.bg}
                    trackColor={{ false: colors.surface2, true: colors.text }}
                  />
                  <Pressable onPress={() => openEdit(t)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>{t.title}</Text>
              <Text style={{ fontSize: 12, fontFamily: 'ProductSans-Regular', color: colors.textSecondary }}>{t.body}</Text>
            </Squircle>
          ))}
        </View>
      ))}

      {/* Create / edit modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16, fontFamily: 'ProductSans-Bold', color: colors.text }}>
              {editTarget ? 'Edit Template' : 'New Template'}
            </Text>
            <Pressable onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View style={{ gap: 8 }}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>NAME</Text>
              <TextInput value={fName} onChangeText={setFName} placeholder="Template name" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>LANGUAGE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(LANG_LABELS).map(([code, label]) => (
                  <Pressable key={code} onPress={() => setFLang(code)}>
                    <View style={[styles.chip, { backgroundColor: fLang === code ? colors.text : colors.surface2, borderColor: colors.border }]}>
                      <Text style={[styles.chipText, { color: fLang === code ? colors.bg : colors.text }]}>{label}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['promotions', 'dating_tips'] as const).map(tp => (
                  <Pressable key={tp} onPress={() => setFType(tp)}>
                    <View style={[styles.chip, { backgroundColor: fType === tp ? colors.text : colors.surface2, borderColor: colors.border }]}>
                      <Text style={[styles.chipText, { color: fType === tp ? colors.bg : colors.text }]}>
                        {tp === 'promotions' ? '📢 Promotions' : '💡 Dating Tips'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>TITLE</Text>
              <TextInput value={fTitle} onChangeText={setFTitle} placeholder="Push notification title" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.secLabel, { color: colors.textSecondary }]}>BODY</Text>
              <TextInput value={fBody} onChangeText={setFBody} placeholder="Push notification body" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 80 }]} />
            </View>
            <Squircle cornerRadius={16} cornerSmoothing={1} fillColor={colors.text} style={{ height: 50, marginTop: 8 }}>
              <Pressable onPress={handleSave} disabled={saving} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={{ fontSize: 14, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Save Template</Text>}
              </Pressable>
            </Squircle>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Countries Tab ────────────────────────────────────────────────────────────

function CountriesTab({ token, colors }: { token: string; colors: any }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<Country | null>(null);
  const [peakInput, setPeakInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`${API_V1}/admin/marketing/countries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setCountries(d.countries || []); }
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (c: Country) => {
    try {
      await fetch(`${API_V1}/admin/marketing/countries/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      load();
    } catch {}
  };

  const openEdit = (c: Country) => {
    setEditTarget(c);
    setPeakInput(c.peak_hours.join(', '));
  };

  const savePeakHours = async () => {
    if (!editTarget) return;
    const hours = peakInput.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 23);
    if (hours.length === 0) { Alert.alert('Invalid', 'Enter valid hours 0–23'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_V1}/admin/marketing/countries/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ peak_hours: hours }),
      });
      if (res.ok) { setEditTarget(null); load(); }
      else { const d = await res.json(); Alert.alert('Error', d.detail ?? 'Save failed'); }
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  const grouped = groupBy(countries, c => c.region);

  if (loading) return <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.text} />}
    >
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([region, items]) => (
        <View key={region}>
          <Text style={[styles.secLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
            {region.toUpperCase()} ({items.length})
          </Text>
          {items.map(c => (
            <Squircle key={c.id} style={[styles.card, { gap: 8, opacity: c.is_active ? 1 : 0.5, marginBottom: 8 }]} cornerRadius={18} cornerSmoothing={1} fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>{c.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'ProductSans-Regular' }}>
                    {c.tz_name} · {LANG_LABELS[c.primary_language] ?? c.primary_language}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => openEdit(c)} hitSlop={8}>
                    <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Switch
                    value={c.is_active}
                    onValueChange={() => toggleActive(c)}
                    thumbColor={colors.bg}
                    trackColor={{ false: colors.surface2, true: colors.text }}
                  />
                </View>
              </View>
              {/* Peak hours pills */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(c.peak_hours || []).map(h => (
                  <View key={h} style={[styles.hourPill, { backgroundColor: colors.surface2 }]}>
                    <Text style={{ fontSize: 11, fontFamily: 'ProductSans-Bold', color: colors.text }}>{String(h).padStart(2, '0')}:00</Text>
                  </View>
                ))}
              </View>

              {/* Inline peak hours editor */}
              {editTarget?.id === c.id && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: 'ProductSans-Regular' }}>
                    Enter local hours (0–23), comma or space separated:
                  </Text>
                  <TextInput
                    value={peakInput}
                    onChangeText={setPeakInput}
                    placeholder="8, 12, 19, 21"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => setEditTarget(null)} style={{ flex: 1 }}>
                      <Squircle style={{ height: 38, alignItems: 'center', justifyContent: 'center' }} cornerRadius={12} cornerSmoothing={1} fillColor={colors.surface2} strokeColor={colors.border} strokeWidth={1}>
                        <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.text }}>Cancel</Text>
                      </Squircle>
                    </Pressable>
                    <Pressable onPress={savePeakHours} disabled={saving} style={{ flex: 1 }}>
                      <Squircle style={{ height: 38, alignItems: 'center', justifyContent: 'center' }} cornerRadius={12} cornerSmoothing={1} fillColor={colors.text} strokeColor={colors.text} strokeWidth={0}>
                        {saving
                          ? <ActivityIndicator color={colors.bg} size="small" />
                          : <Text style={{ fontSize: 13, fontFamily: 'ProductSans-Bold', color: colors.bg }}>Save</Text>}
                      </Squircle>
                    </Pressable>
                  </View>
                </View>
              )}
            </Squircle>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminMarketingPage() {
  const { colors } = useAppTheme();
  const { token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'countries'>('send');

  if (!token) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Marketing" onClose={() => router.back()} />

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TabPill label="Send"      icon="send-outline"    active={activeTab === 'send'}      onPress={() => setActiveTab('send')}      colors={colors} />
        <TabPill label="Templates" icon="document-text-outline" active={activeTab === 'templates'} onPress={() => setActiveTab('templates')} colors={colors} />
        <TabPill label="Countries" icon="earth-outline"   active={activeTab === 'countries'} onPress={() => setActiveTab('countries')} colors={colors} />
      </View>

      {activeTab === 'send'      && <SendTab      token={token} colors={colors} />}
      {activeTab === 'templates' && <TemplatesTab token={token} colors={colors} />}
      {activeTab === 'countries' && <CountriesTab token={token} colors={colors} />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1 },
  tabBar:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tabPill:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50 },
  tabText:     { fontSize: 13, fontFamily: 'ProductSans-Bold' },
  card:        { padding: 14 },
  secLabel:    { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.1 },
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 50, borderWidth: 1 },
  chipText:    { fontSize: 12, fontFamily: 'ProductSans-Regular' },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'ProductSans-Regular',
  },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 10, fontFamily: 'ProductSans-Bold', color: '#fff' },
  hourPill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
