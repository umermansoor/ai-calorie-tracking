export const colors = {
  bg: '#F6F6F8',
  surface: '#FFFFFF',
  muted: '#F2F2F5',
  border: '#E8E8EE',
  text: '#111114',
  textMuted: '#83838E',
  textFaint: '#B3B3BD',
  primary: '#111114',
  onPrimary: '#FFFFFF',
  track: '#ECECF1',
  protein: '#E26B62',
  carbs: '#E7A33E',
  fat: '#5B8DEF',
  fiber: '#8E6CEF',
  sugar: '#EC6A9C',
  sodium: '#D9A534',
  success: '#2FB36B',
  warning: '#F29D38',
  danger: '#E5484D',
  streak: '#F28C28',
  backdrop: 'rgba(10, 10, 14, 0.45)',
  /** Web only: the area around the phone-sized app column. */
  page: '#E7E7EB',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const shadow = {
  card: '0px 1px 2px rgba(17, 17, 20, 0.04), 0px 6px 18px rgba(17, 17, 20, 0.05)',
  raised: '0px 8px 24px rgba(17, 17, 20, 0.18)',
} as const;

/** Width of the phone-sized column the app renders in on desktop browsers. */
export const APP_MAX_WIDTH = 460;

export const APP_NAME = 'Forkcast';
