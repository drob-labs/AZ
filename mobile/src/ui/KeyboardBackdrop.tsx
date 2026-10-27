import type { ReactNode } from 'react';
import { KeyboardAvoidingView, type StyleProp, type ViewStyle } from 'react-native';

// Sfondi i çdo modali me fusha shkrimi: ngre fletën mbi tastierën që fusha ku shkruhet të dallohet gjithmonë.
// Çdo modal i ri me TextInput duhet ta përdorë këtë në vend të View të thjeshtë.
export function KeyboardBackdrop({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}
