/**
 * SuspendedScreen — shown when the backend returns 403 "Account has been suspended."
 *
 * The user can tap "Contact Support" to send an email, and "Log Out" to clear
 * the session so another account can log in on this device.
 */
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';

const SUPPORT_EMAIL = 'support@ailoo.co';

export default function SuspendedScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { signOut } = useAuth();

  const handleContact = () => {
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=Account%20Suspension%20Appeal`,
    ).catch(() => {});
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: '#FF3B3020' }]}>
        <Ionicons name="ban-outline" size={40} color="#FF3B30" />
      </View>

      {/* Heading */}
      <Text style={[styles.title, { color: colors.text }]}>Account Suspended</Text>

      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Your account has been suspended due to a violation of our{' '}
        <Text style={{ color: colors.text }}>Community Guidelines</Text>.{'\n\n'}
        If you believe this is a mistake, please reach out to our support team
        and we'll review your case.
      </Text>

      {/* CTA buttons */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.text, opacity: pressed ? 0.75 : 1 },
          ]}
          onPress={handleContact}
        >
          <Ionicons name="mail-outline" size={18} color={colors.bg} />
          <Text style={[styles.primaryBtnText, { color: colors.bg }]}>Contact Support</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={signOut}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: 'ProductSans-Black',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontFamily: 'ProductSans-Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 50,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'ProductSans-Bold',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: 'ProductSans-Regular',
  },
});
