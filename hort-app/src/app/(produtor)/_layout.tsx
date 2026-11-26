import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/shared/theme/tokens';
export const unstable_settings = { anchor: 'resumo' };
const icons = {
  resumo: {
    source: require('../../../assets/account/tab-home.svg'),
    width: 22.1495,
    height: 22.1495,
  },
  produtos: {
    source: require('../../../assets/producer-account/tab-products.svg'),
    width: 28,
    height: 22.2077,
  },
  planos: {
    source: require('../../../assets/producer-account/tab-plans.svg'),
    width: 24.15,
    height: 22.0023,
  },
  perfil: {
    source: require('../../../assets/account/tab-account.svg'),
    width: 22.1495,
    height: 22.1495,
  },
};
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
          height: 69.217 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.surface,
        tabBarInactiveTintColor: '#E5EAE3',
        tabBarItemStyle: { minHeight: 48 },
        tabBarHideOnKeyboard: true,
      }}
    >
      {(['resumo', 'produtos', 'planos', 'perfil'] as const).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: {
              resumo: 'Resumo',
              produtos: 'Produtos',
              planos: 'Planos',
              perfil: 'Conta',
            }[name],
            tabBarAccessibilityLabel: {
              resumo: 'Resumo do produtor',
              produtos: 'Produtos',
              planos: 'Planos',
              perfil: 'Conta do produtor',
            }[name],
            tabBarButtonTestID: `producer-${name}-tab`,
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 18.458,
                  paddingVertical: 9.229,
                  backgroundColor: focused ? '#64A249' : 'transparent',
                }}
              >
                <Image
                  source={icons[name].source}
                  style={{
                    width: icons[name].width,
                    height: icons[name].height,
                  }}
                  accessible={false}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
