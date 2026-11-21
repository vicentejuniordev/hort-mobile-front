import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/shared/theme/tokens';
export const unstable_settings = { anchor: 'resumo' };
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
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveBackgroundColor: '#64A249',
        tabBarActiveTintColor: theme.colors.surface,
        tabBarInactiveTintColor: '#E5EAE3',
        tabBarLabelStyle: { fontFamily: theme.fonts.medium, fontSize: 12 },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
          marginVertical: 4,
          minHeight: 48,
        },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'beside-icon',
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="resumo"
        options={{
          title: 'Resumo',
          tabBarButtonTestID: 'producer-summary-tab',
        }}
      />
      <Tabs.Screen
        name="produtos"
        options={{
          title: 'Produtos',
          tabBarButtonTestID: 'producer-products-tab',
        }}
      />
      <Tabs.Screen
        name="planos"
        options={{ title: 'Planos', tabBarButtonTestID: 'producer-plans-tab' }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Conta', tabBarButtonTestID: 'producer-account-tab' }}
      />
    </Tabs>
  );
}
