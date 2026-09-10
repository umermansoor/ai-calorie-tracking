import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, ScreenHeader, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { startAnalysis } from '@/lib/analyze';
import { goBack } from '@/lib/nav';

const MAX_LENGTH = 512; // January's limit for text analysis
const EXAMPLES = [
  '2 scrambled eggs, sourdough toast with butter and a latte',
  'Chicken burrito bowl with rice, black beans and guacamole',
  'Greek yogurt with blueberries, granola and honey',
  'Two slices of pepperoni pizza and a can of Coke',
];

export default function DescribeScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = text.trim();

  const submit = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    await startAnalysis({ kind: 'text', text: trimmed }, { source: 'text', label: trimmed });
    goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Describe meal" onBack={goBack} backIcon="close" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <T variant="title">What did you eat?</T>
        <T color={colors.textMuted}>
          Describe it in your own words. January AI works out the portions and nutrition, then adds it to your log.
        </T>
        <View style={styles.inputBox}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_LENGTH))}
            placeholder="e.g. A turkey sandwich on rye with mustard and an apple"
            placeholderTextColor={colors.textFaint}
            multiline
            autoFocus
            style={styles.input}
          />
          <T variant="caption" style={styles.counter}>
            {text.length}/{MAX_LENGTH}
          </T>
        </View>
        <T variant="label">Try an example</T>
        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <Chip key={example} label={example} onPress={() => setText(example)} />
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Analyze meal" icon="sparkles" disabled={!trimmed} loading={busy} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 14 },
  inputBox: { backgroundColor: colors.muted, borderRadius: radius.lg, padding: 14, gap: 6 },
  input: {
    minHeight: 120,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    textAlignVertical: 'top',
    padding: 0,
  },
  counter: { alignSelf: 'flex-end' },
  examples: { gap: 8, alignItems: 'flex-start' },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
