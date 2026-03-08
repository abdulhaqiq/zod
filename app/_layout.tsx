import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Text, View } from 'react-native';
import 'react-native-reanimated';

import AppSplashScreen from '@/components/AppSplashScreen';
import ThemeToggle from '@/components/ThemeToggle';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Apply Product Sans as the global default for every Text component
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: 'ProductSans-Regular' };

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { isDark } = useAppTheme();
  const [splashDone, setSplashDone] = useState(false);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="phone" options={{ headerShown: false }} />
          <Stack.Screen name="otp" options={{ headerShown: false }} />
          <Stack.Screen name="passkey" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="gender" options={{ headerShown: false }} />
          <Stack.Screen name="purpose"   options={{ headerShown: false }} />
          <Stack.Screen name="goals"     options={{ headerShown: false }} />
          <Stack.Screen name="height"    options={{ headerShown: false }} />
          <Stack.Screen name="interests" options={{ headerShown: false }} />
          <Stack.Screen name="lifestyle" options={{ headerShown: false }} />
          <Stack.Screen name="values"    options={{ headerShown: false }} />
          <Stack.Screen name="prompts"   options={{ headerShown: false }} />
          <Stack.Screen name="photos"    options={{ headerShown: false }} />
          <Stack.Screen name="feed"         options={{ headerShown: false }} />
          <Stack.Screen name="profile-view"  options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="edit-profile"    options={{ headerShown: false }} />
          <Stack.Screen name="verification"    options={{ headerShown: false }} />
          <Stack.Screen name="work-experience" options={{ headerShown: false }} />
          <Stack.Screen name="education"       options={{ headerShown: false }} />
          <Stack.Screen name="location-search"  options={{ headerShown: false }} />
          <Stack.Screen name="subscription"    options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="chat"           options={{ headerShown: false }} />
          <Stack.Screen name="modal"     options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {!splashDone && <AppSplashScreen onFinish={() => setSplashDone(true)} />}
        {splashDone && <ThemeToggle />}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'ProductSans-Regular': require('@/assets/product sans full/ProductSans-Regular.ttf'),
    'ProductSans-Medium': require('@/assets/product sans full/ProductSans-Medium.ttf'),
    'ProductSans-Bold': require('@/assets/product sans full/ProductSans-Bold.ttf'),
    'ProductSans-Black': require('@/assets/product sans full/ProductSans-Black.ttf'),
    'ProductSans-Light': require('@/assets/product sans full/ProductSans-Light.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <RootLayoutInner />
    </AppThemeProvider>
  );
}
