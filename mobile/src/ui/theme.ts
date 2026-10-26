import { Platform } from 'react-native';

// Paleta buron nga logoja: jeshile e harkut AZ (#409870), e zezë e shkronjave, bardhë.
export const colors = {
  bg: '#F3F5F2',
  card: '#FFFFFF',
  text: '#16201C',
  muted: '#5B6862',
  border: '#D9DFDA',
  primary: '#2C7A5A',
  primarySoft: '#E6F1EB',
  brand: '#409870',
  start: '#2C7A5A',
  stop: '#B3382F',
  pause: '#A8741A',
  warn: '#9A5B13',
};

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});
