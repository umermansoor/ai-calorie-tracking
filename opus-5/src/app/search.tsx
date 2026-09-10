import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodThumb } from '@/components/food-thumb';
import { Icon, type IconName } from '@/components/icons';
import { Button, Chip, IconButton, ScreenHeader, Skeleton, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { eatenAtFor } from '@/lib/dates';
import { useDebounced } from '@/lib/hooks';
import { errorMessage } from '@/lib/january/client';
import { foodDisplayName, num, primaryServing, servingLabel } from '@/lib/january/mapping';
import type { Food } from '@/lib/january/types';
import { goBack } from '@/lib/nav';
import { createLog, useFoodSearch } from '@/lib/queries';
import { showToast, useApp } from '@/lib/store';

const SUGGESTIONS = ['Banana', 'Greek yogurt', 'Chicken breast', 'Avocado toast', 'Oatmeal', 'Salmon'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const query = useDebounced(input.trim(), 600);
  const search = useFoodSearch(query);
  const selectedDay = useApp((s) => s.selectedDay);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const quickAdd = async (food: Food) => {
    const serving = primaryServing(food);
    if (!serving?.id) {
      router.push(`/food/${food.id}`);
      return;
    }
    setAdding(food.id);
    try {
      await createLog(
        {
          foods: [{ food_id: food.id, serving_id: serving.id, quantity: 1 }],
          eaten_at: eatenAtFor(selectedDay),
          name: foodDisplayName(food),
        },
        { source: 'database', multiplier: 1, imageUrl: food.image_url ?? undefined },
      );
      setAdded((ids) => [...ids, food.id]);
      showToast(`Added ${foodDisplayName(food)}`);
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setAdding(null);
    }
  };

  let results;
  if (query.length < 2) {
    results = (
      <>
        <T variant="label">Popular searches</T>
        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onPress={() => setInput(s)} />
          ))}
        </View>
        <T variant="label" style={styles.sectionGap}>
          Other ways to log
        </T>
        <Shortcut
          icon="sparkles-outline"
          title="Describe with AI"
          subtitle="Type what you ate in plain words"
          onPress={() => router.replace('/describe')}
        />
        <Shortcut
          icon="barcode-outline"
          title="Scan a barcode"
          subtitle="For packaged foods"
          onPress={() => router.replace('/scan?mode=barcode')}
        />
      </>
    );
  } else if (search.isPending) {
    results = [0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} style={styles.skeleton} />);
  } else if (search.error) {
    results = <T variant="caption">{errorMessage(search.error)}</T>;
  } else if (!search.data.length) {
    results = (
      <View style={styles.none}>
        <T variant="label">No matches for “{query}”</T>
        <T variant="caption">Try a simpler name, or describe the meal instead.</T>
        <Button size="md" variant="secondary" icon="sparkles-outline" title="Describe with AI" onPress={() => router.replace('/describe')} />
      </View>
    );
  } else {
    results = search.data.map((food) => (
      <FoodRow
        key={food.id}
        food={food}
        adding={adding === food.id}
        added={added.includes(food.id)}
        onAdd={() => void quickAdd(food)}
        onPress={() => router.push(`/food/${food.id}`)}
      />
    ));
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Food database" onBack={goBack} backIcon="close" />
      <View style={styles.searchBox}>
        <Icon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Search foods, brands or dishes"
          placeholderTextColor={colors.textFaint}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search.isFetching ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
        {input ? <IconButton icon="close" label="Clear search" size={28} onPress={() => setInput('')} /> : null}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        {results}
      </ScrollView>
    </View>
  );
}

function FoodRow({
  food,
  onPress,
  onAdd,
  adding,
  added,
}: {
  food: Food;
  onPress: () => void;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
}) {
  const serving = primaryServing(food);
  const details = [food.brand_name, serving ? servingLabel(serving.quantity, serving.unit) : null]
    .filter(Boolean)
    .join(' · ');
  // The row and its "+" are siblings: react-native-web renders both as <button>, which can't nest.
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <FoodThumb uri={food.image_url} size={48} rounded={12} />
        <View style={styles.rowText}>
          <T variant="label" numberOfLines={1}>
            {foodDisplayName(food)}
          </T>
          {details ? (
            <T variant="caption" numberOfLines={1}>
              {details}
            </T>
          ) : null}
          <View style={styles.kcal}>
            <Icon name="flame" size={13} color={colors.textMuted} />
            <T variant="caption">{Math.round(num(food.nutrients, 'calories'))} cal</T>
          </View>
        </View>
      </Pressable>
      <IconButton
        icon={added ? 'checkmark' : 'add'}
        label={`Add ${foodDisplayName(food)}`}
        size={36}
        color="#FFFFFF"
        background={added ? colors.success : colors.primary}
        disabled={adding}
        onPress={onAdd}
      />
    </View>
  );
}

function Shortcut({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.shortcutIcon}>
        <Icon name={icon} size={20} color={colors.text} />
      </View>
      <View style={styles.rowText}>
        <T variant="label">{title}</T>
        <T variant="caption">{subtitle}</T>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 6,
    paddingLeft: 14,
    paddingRight: 8,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  content: { paddingHorizontal: 18, paddingTop: 12, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionGap: { marginTop: 14 },
  skeleton: { borderRadius: radius.md },
  none: { gap: 8, alignItems: 'flex-start', paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.85 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  kcal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
