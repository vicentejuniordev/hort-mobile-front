import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/shared/theme/tokens';
export const unstable_settings = { anchor: 'catalogo' };
export default function Layout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.primary,
          borderTopWidth: 0,
          height: 72 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveBackgroundColor: '#64A249',
        tabBarActiveTintColor: theme.colors.surface,
        tabBarInactiveTintColor: '#E5EAE3',
        tabBarLabelStyle: { fontFamily: theme.fonts.medium, fontSize: 12 },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
          marginVertical: 6,
          minHeight: 48,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: () => (
            <Image
              source={require('../../../assets/account/tab-home.svg')}
              style={{ width: 22.1495, height: 22.1495 }}
              accessible={false}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="assinaturas"
        options={{
          title: 'Assinaturas',
          tabBarIcon: () => (
            <Image
              source={require('../../../assets/subscriptions/tab-basket.svg')}
              style={{ width: 23.65, height: 20 }}
              accessible={false}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color }) => (
            <Text accessible={false} style={{ color, fontSize: 22 }}>
              ▦
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Conta',
          tabBarIcon: () => (
            <Image
              source={require('../../../assets/account/tab-account.svg')}
              style={{ width: 22.1495, height: 22.1495 }}
              accessible={false}
            />
          ),
        }}
      />
    </Tabs>
  );
}
