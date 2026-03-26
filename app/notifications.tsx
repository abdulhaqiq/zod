import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Squircle from '@/components/ui/Squircle';
import { apiFetch } from '@/constants/api';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifKey =
  | 'notif_new_match'
  | 'notif_new_message'
  | 'notif_super_like'
  | 'notif_liked_profile'
  | 'notif_profile_views'
  | 'notif_ai_picks'
  | 'notif_promotions'
  | 'notif_dating_tips';

interface NotifItem {
  key: NotifKey;
  icon: string;
  label: string;
  subtitle: string;
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS: { title: string; items: NotifItem[] }[] = [
  {
    title: 'MATCHES & MESSAGES',
    items: [
      {
        key:      'notif_new_match',
        icon:     'heart-outline',
        label:    'New Match',
        subtitle: 'When someone matches with you',
      },
      {
        key:      'notif_new_message',
        icon:     'chatbubble-outline',
        label:    'New Message',
        subtitle: 'When a match sends you a message',
      },
      {
        key:      'notif_super_like',
        icon:     'star-outline',
        label:    'Super Like',
        subtitle: 'When someone Super Likes your profile',
      },
    ],
  },
  {
    title: 'ACTIVITY',
    items: [
      {
        key:      'notif_liked_profile',
        icon:     'thumbs-up-outline',
        label:    'Liked Your Profile',
        subtitle: 'When someone likes your profile',
      },
      {
        key:      'notif_profile_views',
        icon:     'eye-outline',
        label:    'Profile Views',
        subtitle: 'When someone views your profile',
      },
      {
        key:      'notif_ai_picks',
        icon:     'sparkles-outline',
        label:    'Zod AI Picks',
        subtitle: 'Your daily AI-curated match suggestions',
      },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      {
        key:      'notif_promotions',
        icon:     'megaphone-outline',
        label:    'Promotions',
        subtitle: 'Offers, discounts and product updates',
      },
      {
        key:      'notif_dating_tips',
        icon:     'bulb-outline',
        label:    'Dating Tips',
        subtitle: 'Advice to improve your matches',
      },
    ],
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { profile, token, updateProfile } = useAuth();

  // Initialise local state from profile (default all ON when not yet persisted)
  const [prefs, setPrefs] = useState<Record<NotifKey, boolean>>({
    notif_new_match:     profile?.notif_new_match     ?? true,
    notif_new_message:   profile?.notif_new_message   ?? true,
    notif_super_like:    profile?.notif_super_like     ?? true,
    notif_liked_profile: profile?.notif_liked_profile  ?? true,
    notif_profile_views: profile?.notif_profile_views  ?? true,
    notif_ai_picks:      profile?.notif_ai_picks       ?? true,
    notif_promotions:    profile?.notif_promotions     ?? true,
    notif_dating_tips:   profile?.notif_dating_tips    ?? true,
  });

  const toggle = useCallback((key: NotifKey, value: boolean) => {
    setPrefs(p => ({ ...p, [key]: value }));
    updateProfile({ [key]: value });

    if (token) {
      apiFetch('/profile/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ [key]: value }),
      }).catch(() => {
        // Revert on failure
        setPrefs(p => ({ ...p, [key]: !value }));
        updateProfile({ [key]: !value });
      });
    }
  }, [token, updateProfile]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <Squircle
              style={styles.card}
              cornerRadius={22}
              cornerSmoothing={1}
              fillColor={colors.surface}
              strokeColor={colors.border}
              strokeWidth={1}
            >
              {section.items.map((item, idx) => (
                <View key={item.key}>
                  <View style={styles.row}>
                    {/* Icon badge */}
                    <View style={[styles.iconBadge, { backgroundColor: colors.bg }]}>
                      <Ionicons name={item.icon as any} size={18} color={colors.text} />
                    </View>

                    {/* Label + subtitle */}
                    <View style={styles.labelWrap}>
                      <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                    </View>

                    {/* Toggle */}
                    <Switch
                      value={prefs[item.key]}
                      onValueChange={v => toggle(item.key, v)}
                      trackColor={{ false: colors.border, true: colors.text }}
                      thumbColor={Platform.OS === 'android' ? colors.bg : undefined}
                      ios_backgroundColor={colors.border}
                    />
                  </View>

                  {idx < section.items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingBottom:    12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 34,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize:   17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  content: {
    padding: 20,
    gap:     16,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingLeft:   4,
  },
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBadge: {
    width:        36,
    height:       36,
    borderRadius: 10,
    alignItems:   'center',
    justifyContent: 'center',
  },
  labelWrap: {
    flex: 1,
    gap:  2,
  },
  rowLabel: {
    fontSize:   15,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
  },
  divider: {
    height:      StyleSheet.hairlineWidth,
    marginLeft:  64,
  },
  footer: {
    fontSize:   12,
    textAlign:  'center',
    marginTop:   8,
  },
});
