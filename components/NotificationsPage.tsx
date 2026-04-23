import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Section / item config ────────────────────────────────────────────────────

type NotifItem = {
  profileKey: string;   // matches user model field name
  icon: string;
  label: string;
  sub: string;
};

const SECTIONS: { title: string; items: NotifItem[] }[] = [
  {
    title: 'MATCHES & MESSAGES',
    items: [
      {
        profileKey: 'notif_new_match',
        icon: 'heart-outline',
        label: 'New Match',
        sub: 'When someone matches with you',
      },
      {
        profileKey: 'notif_new_message',
        icon: 'chatbubble-outline',
        label: 'New Message',
        sub: 'When a match sends you a message',
      },
      {
        profileKey: 'notif_super_like',
        icon: 'star-outline',
        label: 'Super Like',
        sub: 'When someone Super Likes your profile',
      },
    ],
  },
  {
    title: 'ACTIVITY',
    items: [
      {
        profileKey: 'notif_liked_profile',
        icon: 'thumbs-up-outline',
        label: 'Liked Your Profile',
        sub: 'When someone likes your profile',
      },
      {
        profileKey: 'notif_profile_views',
        icon: 'eye-outline',
        label: 'Profile Views',
        sub: 'When someone views your profile',
      },
      {
        profileKey: 'notif_ai_picks',
        icon: 'sparkles-outline',
        label: 'AI Picks',
        sub: 'Your daily AI-curated match suggestions',
      },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      {
        profileKey: 'notif_promotions',
        icon: 'megaphone-outline',
        label: 'Promotions',
        sub: 'Offers, discounts and product updates',
      },
      {
        profileKey: 'notif_dating_tips',
        icon: 'bulb-outline',
        label: 'Dating Tips',
        sub: 'Advice to improve your matches',
      },
    ],
  },
];

// ─── Row ──────────────────────────────────────────────────────────────────────

function ToggleRow({
  icon, label, sub, value, onChange, last, colors,
}: {
  icon: string;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
  colors: any;
}) {
  const handleChange = (v: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(v);
  };

  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg}>
        <Ionicons name={icon as any} size={18} color={colors.text} />
      </Squircle>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{ false: colors.border, true: colors.text }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();

  // Initialise from profile (falls back to true — same as backend default)
  const init = useCallback(
    (key: string) => (profile as any)?.[key] ?? true,
    [profile],
  );

  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      SECTIONS.flatMap(s => s.items.map(i => [i.profileKey, init(i.profileKey)])),
    ),
  );

  const toggle = (key: string) => {
    const next = !state[key];
    setState(p => ({ ...p, [key]: next }));
    // Persist to backend
    apiFetch('/profile/me', {
      method: 'PATCH',
      token: token!,
      body: JSON.stringify({ [key]: next }),
    }).catch(() => {
      // Revert on error
      setState(p => ({ ...p, [key]: !next }));
    });
    updateProfile({ [key]: next } as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <Squircle
              style={styles.group}
              cornerRadius={22}
              cornerSmoothing={1}
              fillColor={colors.surface}
              strokeColor={colors.border}
              strokeWidth={1}
            >
              {section.items.map((item, idx) => (
                <ToggleRow
                  key={item.profileKey}
                  icon={item.icon}
                  label={item.label}
                  sub={item.sub}
                  value={state[item.profileKey]}
                  onChange={() => toggle(item.profileKey)}
                  last={idx === section.items.length - 1}
                  colors={colors}
                />
              ))}
            </Squircle>
          </View>
        ))}

        <Text style={[styles.footer, { color: colors.textSecondary }]}>
          Push notifications must also be enabled in your device Settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, paddingBottom: 40 },
  section:      { marginTop: 24, gap: 8 },
  sectionTitle: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginLeft: 2 },
  group:        { overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowText:      { flex: 1 },
  rowLabel:     { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  rowSub:       { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  footer:       { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
});
