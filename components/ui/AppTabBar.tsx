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
  const bottomInset = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 10);
  const verticalPad = 10;

  const visibleRoutes = state.routes.filter((route) => isVisibleTab(route, descriptors));
  const activeRouteKey = state.routes[state.index]?.key;

  return (
    <View style={[styles.shell, { paddingTop: verticalPad, paddingBottom: verticalPad + bottomInset }]}>
      {/* Deep charcoal base */}
      <LinearGradient
        colors={['#121212', '#0A0A0A', '#050505']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft lime atmosphere from top */}
      <LinearGradient
        colors={['rgba(200,255,0,0.07)', 'rgba(200,255,0,0.02)', 'transparent']}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Side vignette for depth */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.55)']}
        locations={[0, 0.22, 0.78, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Hairline accent rail */}
      <LinearGradient
        colors={['transparent', 'rgba(200,255,0,0.55)', 'rgba(200,255,0,0.18)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topRail}
      />
      <View style={styles.topHairline} pointerEvents="none" />
      <View style={styles.innerSheen} pointerEvents="none" />

      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = activeRouteKey === route.key;
          const label = tabLabel(options);
          const color = focused ? colors.accent : 'rgba(163,163,163,0.78)';

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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200,255,0,0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.72,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -10 },
    elevation: 18,
  },
  topRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  topHairline: {
    position: 'absolute',
    top: 1.5,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  innerSheen: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.015)',
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
    minHeight: 52,
    paddingHorizontal: 2,
  },
  tabPressed: {
    opacity: 0.88,
  },
});
