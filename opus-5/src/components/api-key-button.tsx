import { Linking, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui';
import { API_KEY_URL } from '@/lib/january/client';

/** Opens January's developer site, where API keys are created. */
export function GetApiKeyButton({ size = 'sm', style }: { size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  return (
    <Button
      size={size}
      icon="key-outline"
      title="Get an API key"
      onPress={() => void Linking.openURL(API_KEY_URL)}
      style={style}
    />
  );
}
