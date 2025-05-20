import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { auth } from '../FirebaseConfig';
import { User } from 'firebase/auth';

import { useColorScheme } from '@/components/useColorScheme';
import { onAuthStateChanged } from '@firebase/auth';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const segments = useSegments();
  const router = useRouter();

  const colorScheme = useColorScheme();
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inChat = segments[0] === 'chat';
    const inProfile = segments[0] === 'profile';

    if (!user && (inAuthGroup || inChat || inProfile)) {
      router.replace('/');
    } else if (user && !inAuthGroup && !inChat && !inProfile) {
      router.replace('/(tabs)/users');
    }
  }, [segments, authChecked, user]);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded || !authChecked) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTitle: '',
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTitle: '',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerTitle: 'Edit Profile',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
