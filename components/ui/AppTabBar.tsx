import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabItem } from '@/components/ui/TabIcons';
import { colors } from '@/constants/theme';

function tabLabel(options: BottomTabBarProps['descriptors'][string]['options']) {
  const raw = options.tabBarLabel ?? options.title;
  if (typeof raw === 'string') return raw;
  return '';
}

function isVisibleTab(
  route: BottomTabBarProps['state']['routes'][number],
  descriptors: BottomTabBarProps['descriptors'],
) {
  const options = descriptors[route.key]?.options;
  if (!options) return false;
  if (options.href === null) return false;
  return Boolean(options.tabBarIcon);
}

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8);
  const verticalPad = 8;

  const visibleRoutes = state.routes.filter((route) => isVisibleTab(route, descriptors));
  const activeRouteKey = state.routes[state.index]?.key;

  return (
    <View style={[styles.shell, { paddingTop: verticalPad, paddingBottom: verticalPad + bottomInset }]}>
      <LinearGradient
        colors={['#141414', '#0C0C0C', '#080808']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(200,255,0,0.22)', 'rgba(200,255,0,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
      />
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = activeRouteKey === route.key;
          const label = tabLabel(options);
          const color = focused ? colors.accent : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const icon = options.tabBarIcon?.({
            focused,
            color,
            size: 22,
          });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
              <TabItem label={label} focused={focused}>
                {icon}
              </TabItem>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,255,0,0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tab: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
  },
  tabPressed: {
    opacity: 0.92,
  },
});
