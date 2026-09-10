import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HealthierSwaps } from '@/components/alternatives';
import { GetApiKeyButton } from '@/components/api-key-button';
import { FoodThumb } from '@/components/food-thumb';
import { Icon } from '@/components/icons';
import { MACROS, MacroTile } from '@/components/macros';
import { NutrientList } from '@/components/nutrient-list';
import { Button, Card, Chip, ProgressBar, ScreenHeader, Stepper, T } from '@/components/ui';
import { colors } from '@/constants/theme';
import { eatenAtFor } from '@/lib/dates';
import { errorMessage, isApiKeyError, JanuaryError } from '@/lib/january/client';
import { foodDisplayName, num, primaryServing, servingLabel, servingNutrients } from '@/lib/january/mapping';
import { goBack } from '@/lib/nav';
import { healthScore, healthScoreColor } from '@/lib/nutrition';
import { createLog, useBarcodeFood, useFood } from '@/lib/queries';
import { showToast, useApp } from '@/lib/store';

const glycemicBand = (value: number, [low, high]: [number, number]) =>
  value <= low ? 'low' : value < high ? 'medium' : 'high';

export default function FoodScreen() {
  const insets = useSafeAreaInsets();
  const { id, barcode } = useLocalSearchParams<{ id: string; barcode?: string }>();
  const byBarcode = id === 'barcode';
  const barcodeQuery = useBarcodeFood(byBarcode ? barcode : undefined);
  // Barcode and search results carry only the primary serving; the full food has them all.
  const foodQuery = useFood(byBarcode ? barcodeQuery.data?.id : id);
  const food = foodQuery.data ?? barcodeQuery.data;
  const selectedDay = useApp((s) => s.selectedDay);
  const [servingId, setServingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!food) {
    const error = barcodeQuery.error ?? foodQuery.error;
    const notFound = error instanceof JanuaryError && error.code === 'not_found';
    return (
      <View style={styles.screen}>
        <ScreenHeader title={byBarcode ? 'Scanned product' : 'Food'} onBack={goBack} />
        <View style={styles.center}>
          {!error ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Icon name={notFound ? 'barcode-outline' : 'alert-circle-outline'} size={36} color={colors.textMuted} />
              <T variant="heading" align="center">
                {notFound && byBarcode ? 'No product found' : 'Couldn’t load this food'}
              </T>
              <T variant="caption" align="center">
                {notFound && byBarcode
                  ? `January doesn’t know barcode ${barcode}. Try searching for it by name.`
                  : errorMessage(error)}
              </T>
              <View style={styles.centerActions}>
                {isApiKeyError(error) ? (
                  <GetApiKeyButton size="md" />
                ) : (
                  <>
                    <Button size="md" icon="search-outline" title="Search by name" onPress={() => router.replace('/search')} />
                    {byBarcode ? (
                      <Button
                        size="md"
                        variant="secondary"
                        title="Scan again"
                        onPress={() => router.replace('/scan?mode=barcode')}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  const serving = food.servings.find((s) => s.id === servingId) ?? primaryServing(food);
  const nutrients = servingNutrients(food, serving, quantity);
  const score = healthScore(nutrients);
  const baseCarbs = num(food.nutrients, 'carbohydrates');
  const glycemicLoad =
    food.glycemic_load != null && baseCarbs > 0 ? (food.glycemic_load * num(nutrients, 'carbohydrates')) / baseCarbs : null;
  const name = foodDisplayName(food);

  const logFood = async () => {
    if (!serving?.id) return;
    setSaving(true);
    try {
      await createLog(
        { foods: [{ food_id: food.id, serving_id: serving.id, quantity }], eaten_at: eatenAtFor(selectedDay), name },
        { source: byBarcode ? 'barcode' : 'database', multiplier: 1, imageUrl: food.image_url ?? undefined },
      );
      showToast(`Logged ${name}`);
      router.dismissTo('/');
    } catch (e) {
      showToast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  const kind = food.type === 'branded' ? 'Branded' : food.type === 'recipe' ? 'Recipe' : 'Generic';
  return (
    <View style={styles.screen}>
      <ScreenHeader title={byBarcode ? 'Scanned product' : 'Selected food'} onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <FoodThumb uri={food.image_url} size={72} rounded={18} />
          <View style={styles.flex}>
            <T variant="heading">{name}</T>
            <T variant="caption">{[food.brand_name, kind, food.barcode ? `#${food.barcode}` : null].filter(Boolean).join(' · ')}</T>
          </View>
        </View>

        <T variant="label">Measurement</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {food.servings.map((s) =>
            s.id ? (
              <Chip
                key={s.id}
                label={`${servingLabel(s.quantity, s.unit)}${s.weight_grams && s.unit !== 'g' ? ` · ${Math.round(s.weight_grams)} g` : ''}`}
                selected={s.id === serving?.id}
                onPress={() => setServingId(s.id)}
              />
            ) : null,
          )}
          {foodQuery.isFetching ? <ActivityIndicator color={colors.textMuted} style={styles.chipSpinner} /> : null}
        </ScrollView>

        <View style={styles.rowBetween}>
          <T variant="label">Number of servings</T>
          <Stepper value={quantity} onChange={setQuantity} step={0.5} min={0.5} max={20} />
        </View>

        <Card style={styles.caloriesCard}>
          <View style={styles.flameBadge}>
            <Icon name="flame" size={22} color={colors.text} />
          </View>
          <View>
            <T variant="caption">Calories</T>
            <T style={styles.caloriesValue}>{Math.round(num(nutrients, 'calories'))}</T>
          </View>
        </Card>
        <View style={styles.macroRow}>
          {MACROS.map((m) => (
            <MacroTile key={m.key} stat={m} value={num(nutrients, m.nutrient)} />
          ))}
        </View>

        {score != null ? (
          <Card style={styles.gap8}>
            <View style={styles.rowBetween}>
              <T variant="label">Health score</T>
              <T variant="label">{score}/10</T>
            </View>
            <ProgressBar value={score / 10} color={healthScoreColor(score)} height={7} />
          </Card>
        ) : null}

        {food.glycemic_index != null || glycemicLoad != null ? (
          <Card style={styles.gap8}>
            <T variant="label">Glycemic impact</T>
            {food.glycemic_index != null ? (
              <View style={styles.rowBetween}>
                <T color={colors.textMuted}>Glycemic index</T>
                <T variant="label">
                  {Math.round(food.glycemic_index)} · {glycemicBand(food.glycemic_index, [55, 70])}
                </T>
              </View>
            ) : null}
            {glycemicLoad != null ? (
              <View style={styles.rowBetween}>
                <T color={colors.textMuted}>Glycemic load</T>
                <T variant="label">
                  {Math.round(glycemicLoad)} · {glycemicBand(glycemicLoad, [10, 20])}
                </T>
              </View>
            ) : null}
          </Card>
        ) : null}

        <NutrientList nutrients={nutrients} />
        <HealthierSwaps foodId={food.id} foodName={name} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button title="Log food" icon="add" loading={saving} disabled={!serving?.id} onPress={logFood} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, gap: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  centerActions: { gap: 8, marginTop: 8, alignSelf: 'stretch' },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 32, gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chips: { gap: 8, paddingRight: 18 },
  chipSpinner: { marginLeft: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caloriesCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flameBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caloriesValue: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  macroRow: { flexDirection: 'row', gap: 10 },
  gap8: { gap: 8 },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
