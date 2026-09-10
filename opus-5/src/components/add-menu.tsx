import { type Href, router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { analyzePhoto, pickPhoto } from '@/lib/analyze';
import { errorMessage } from '@/lib/january/client';
import { showToast, useApp } from '@/lib/store';

export function AddMenu() {
  const open = useApp((s) => s.addMenuOpen);
  const setOpen = useApp((s) => s.setAddMenuOpen);

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  const upload = async () => {
    setOpen(false);
    // iOS can't present the picker while the sheet is still closing; web has to open it within the tap.
    if (Platform.OS !== 'web') await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      const asset = await pickPhoto('library');
      if (!asset) return;
      router.navigate('/');
      await analyzePhoto(asset.uri, 'photo', asset.width, asset.height);
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  const items: { icon: IconName; label: string; hint: string; onPress: () => void }[] = [
    { icon: 'scan-outline', label: 'Scan food', hint: 'Use your camera', onPress: () => go('/scan') },
    { icon: 'images-outline', label: 'Upload photo', hint: 'From your library', onPress: () => void upload() },
    { icon: 'search-outline', label: 'Food database', hint: 'Search foods & brands', onPress: () => go('/search') },
    { icon: 'sparkles-outline', label: 'Describe meal', hint: 'Type what you ate', onPress: () => go('/describe') },
  ];

  return (
    <Sheet visible={open} onClose={() => setOpen(false)}>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={item.onPress}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <View style={styles.icon}>
              <Icon name={item.icon} size={24} color={colors.text} />
            </View>
            <T variant="label">{item.label}</T>
            <T variant="caption">{item.hint}</T>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6 },
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 16,
    gap: 2,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
