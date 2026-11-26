import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'index' };
export default function CatalogLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          presentation: 'card',
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/cestas/[cestaId]" />
    </Stack>
  );
}
