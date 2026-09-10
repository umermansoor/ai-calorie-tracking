import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type MIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export { Ionicons as Icon, MaterialCommunityIcons as MIcon };
