import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Squircle from '@/components/ui/Squircle';
import { useAppTheme } from '@/context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
};

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS: { title: string; items: NotifItem[] }[] = [
  {
    title: 'MATCHES & MESSAGES',
    items: [
      { id: 'new_match',    icon: 'heart-outline',      label: 'New Match',          sub: 'When someone matches with you'          },
      { id: 'message',      icon: 'chatbubble-outline',  label: 'New Message',        sub: 'When a match sends you a message'       },
      { id: 'super_like',   icon: 'star-outline',        label: 'Super Like',         sub: 'When someone Super Likes your profile'  },
    ],
  },
  {
    title: 'ACTIVITY',
    items: [
      { id: 'liked_you',    icon: 'thumbs-up-outline',   label: 'Liked Your Profile', sub: 'When someone likes your profile'        },
      { id: 'profile_view', icon: 'eye-outline',         label: 'Profile Views',      sub: 'When someone views your profile'        },
      { id: 'zod_picks',    icon: 'sparkles-outline',    label: 'Zod AI Picks',       sub: 'Your daily AI-curated match suggestions'},
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { id: 'promo',        icon: 'megaphone-outline',   label: 'Promotions',         sub: 'Offers, discounts and product updates'  },
      { id: 'tips',         icon: 'bulb-outline',        label: 'Dating Tips',        sub: 'Advice to improve your matches'         },
    ],
  },
];

// ─── Row ──────────────────────────────────────────────────────────────────────

function NotifRow({
  item, value, onChange, last, colors,
}: {
  item: NotifItem;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
  colors: any;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Squircle style={styles.iconWrap} cornerRadius={10} cornerSmoothing={1} fillColor={colors.bg}>
        <Ionicons name={item.icon} size={18} color={colors.text} />
      </Squircle>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{item.sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.text }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { colors } = useAppTheme();

  const allIds = SECTIONS.flatMap(s => s.items.map(i => i.id));
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(allIds.map(id => [id, true]))
  );

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState(p => ({ ...p, [id]: !p[id] }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
            <Squircle style={styles.group} cornerRadius={22} cornerSmoothing={1}
              fillColor={colors.surface} strokeColor={colors.border} strokeWidth={1}>
              {section.items.map((item, idx) => (
                <NotifRow
                  key={item.id}
                  item={item}
                  value={state[item.id]}
                  onChange={() => toggle(item.id)}
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
  section:      { marginTop: 24 },
  sectionTitle: { fontSize: 11, fontFamily: 'ProductSans-Bold', letterSpacing: 1.4, marginBottom: 8, marginLeft: 2 },
  group:        { overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  iconWrap:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rowText:      { flex: 1 },
  rowLabel:     { fontSize: 15, fontFamily: 'ProductSans-Medium' },
  rowSub:       { fontSize: 12, fontFamily: 'ProductSans-Regular', marginTop: 2 },
  footer:       { fontSize: 12, fontFamily: 'ProductSans-Regular', textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
});
