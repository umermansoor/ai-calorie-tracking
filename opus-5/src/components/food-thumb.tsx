import { Image } from 'expo-image';
import { View } from 'react-native';

import { MIcon } from '@/components/icons';
import { colors } from '@/constants/theme';

export function FoodThumb({ uri, size, rounded = 16 }: { uri?: string | null; size: number; rounded?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        transition={150}
        style={{ width: size, height: size, borderRadius: rounded, backgroundColor: colors.muted }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        backgroundColor: '#F1EEE8',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <MIcon name="silverware-fork-knife" size={Math.round(size * 0.36)} color="#BDB5A6" />
    </View>
  );
}
