import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { T } from '@/components/ui';
import { colors, shadow } from '@/constants/theme';
import { useApp } from '@/lib/store';

const TAB_ICONS: Record<string, [active: IconName, inactive: IconName]> = {
  index: ['home', 'home-outline'],
  progress: ['stats-chart', 'stats-chart-outline'],
  settings: ['settings', 'settings-outline'],
};

/** Cal AI's bar: three tabs on the left and a floating black "+" on the right. */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const setAddMenuOpen = useApp((s) => s.setAddMenuOpen);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [active, inactive] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          const title = descriptors[route.key]?.options.title ?? route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={styles.tab}>
              <Icon name={focused ? active : inactive} size={23} color={focused ? colors.text : colors.textFaint} />
              <T style={[styles.label, { color: focused ? colors.text : colors.textFaint }]}>{title}</T>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add food"
        onPress={() => setAddMenuOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Icon name="add" size={32} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  tabs: { flex: 1, flexDirection: 'row', marginRight: 84 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { fontSize: 11.5, lineHeight: 14, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    top: -26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.raised,
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
});
