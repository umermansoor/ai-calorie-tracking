import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HealthierSwaps } from '@/components/alternatives';
import { GlucoseCard } from '@/components/glucose-card';
import { Icon, type IconName, MIcon } from '@/components/icons';
import { MACROS, MacroTile } from '@/components/macros';
import { NutrientList } from '@/components/nutrient-list';
import { Sheet } from '@/components/sheet';
import { Button, Card, Chip, IconButton, ProgressBar, Stepper, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { formatTime } from '@/lib/dates';
import { useStoredImage } from '@/lib/images';
import { errorMessage, january } from '@/lib/january/client';
import {
  analysisToSelections,
  capitalize,
  formatQty,
  logAsAnalysis,
  loggedAmount,
  logToSelections,
  logTotals,
  num,
  scaleNutrients,
  servingLabel,
  servingSizes,
} from '@/lib/january/mapping';
import type { FoodLog, FoodSelection, LoggedFood } from '@/lib/january/types';
import { goBack } from '@/lib/nav';
import { healthScore, healthScoreColor, healthScoreNote } from '@/lib/nutrition';
import { deleteLog, relogMeal, updateLog, useLog } from '@/lib/queries';
import { type MealSource, showToast, useApp } from '@/lib/store';

const SOURCE_LABEL: Record<MealSource, { label: string; icon: IconName }> = {
  photo: { label: 'Photo scan', icon: 'camera-outline' },
  label: { label: 'Label scan', icon: 'document-text-outline' },
  text: { label: 'Described', icon: 'sparkles-outline' },
  database: { label: 'Food database', icon: 'search-outline' },
  barcode: { label: 'Barcode', icon: 'barcode-outline' },
};

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export default function MealScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { log, isLoading } = useLog(id);
  const meta = useApp((s) => s.meta[id]);
  const patchMeta = useApp((s) => s.patchMeta);
  const stored = useStoredImage(id);
  const [draftServings, setDraftServings] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const multiplier = meta?.multiplier ?? 1;

  // Debounce the servings stepper so a burst of taps is one PATCH (and one credit).
  useEffect(() => {
    if (!log || draftServings === null || draftServings === multiplier) return;
    const timer = setTimeout(() => {
      const factor = draftServings / multiplier;
      const foods = logToSelections(log).map((f) => ({ ...f, quantity: round3(f.quantity * factor) }));
      setSaving(true);
      updateLog(id, { foods })
        .then(() => patchMeta(id, { multiplier: draftServings }))
        .catch((e: unknown) => showToast(errorMessage(e), 'error'))
        .finally(() => {
          setSaving(false);
          setDraftServings(null);
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [draftServings, multiplier, log, id, patchMeta]);

  if (!log) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        {isLoading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <T variant="heading">Meal not found</T>
            <T variant="caption" align="center">
              It may have been deleted, or it belongs to a different profile.
            </T>
            <Button size="md" title="Back to home" onPress={() => router.replace('/')} />
          </>
        )}
      </View>
    );
  }

  const servings = draftServings ?? multiplier;
  const totals = scaleNutrients(logTotals(log), servings / multiplier); // preview while a change is pending
  const score = healthScore(totals);
  const heroImage =
    stored ?? meta?.imageUrl ?? (log.foods.length === 1 ? log.foods[0].image_url : null) ?? null;
  const mainFood = log.foods.reduce<LoggedFood | undefined>(
    (best, f) => (f.food_id && num(f.nutrients, 'calories') > num(best?.nutrients, 'calories') ? f : best),
    undefined,
  );
  const source = meta ? SOURCE_LABEL[meta.source] : null;

  const saveFoods = async (foods: FoodSelection[], message: string) => {
    setSaving(true);
    try {
      await updateLog(id, { foods });
      showToast(message);
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setMenuOpen(false);
    if (!(await confirmAction('Delete meal?', 'This removes it from your January food log.', 'Delete', true))) return;
    try {
      await deleteLog(id);
      showToast('Meal deleted');
      goBack();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  const logAgain = async () => {
    setMenuOpen(false);
    try {
      await relogMeal(log);
      showToast('Logged again for today');
    } catch (e) {
      showToast(errorMessage(e), 'error');
    }
  };

  const editingFood = editing !== null ? log.foods[editing] : undefined;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
              <MIcon name="silverware-fork-knife" size={56} color="#C9C1B1" />
            </View>
          )}
          <View style={[styles.heroBar, { paddingTop: insets.top + 10 }]}>
            <IconButton icon="chevron-back" label="Back" color="#FFFFFF" background="rgba(0,0,0,0.35)" onPress={goBack} />
            <T style={styles.heroTitle}>Nutrition</T>
            <IconButton
              icon="ellipsis-horizontal"
              label="More actions"
              color="#FFFFFF"
              background="rgba(0,0,0,0.35)"
              onPress={() => setMenuOpen(true)}
            />
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.metaRow}>
            {source ? (
              <View style={styles.pill}>
                <Icon name={source.icon} size={13} color={colors.textMuted} />
                <T style={styles.pillText}>{source.label}</T>
              </View>
            ) : (
              <View />
            )}
            <View style={styles.pill}>
              <T style={styles.pillText}>{formatTime(log.eaten_at)}</T>
            </View>
          </View>

          <View style={styles.titleRow}>
            <T variant="title" style={styles.flex}>
              {log.name ?? capitalize(log.foods[0]?.name ?? 'Meal')}
            </T>
            <Stepper value={servings} onChange={setDraftServings} step={0.5} min={0.5} max={10} disabled={saving} />
          </View>

          <Card style={styles.caloriesCard}>
            <View style={styles.flameBadge}>
              <Icon name="flame" size={22} color={colors.text} />
            </View>
            <View style={styles.flex}>
              <T variant="caption">Calories</T>
              <T style={styles.caloriesValue}>{Math.round(num(totals, 'calories'))}</T>
            </View>
            {saving ? <ActivityIndicator color={colors.textMuted} /> : null}
          </Card>
          <View style={styles.macroRow}>
            {MACROS.map((m) => (
              <MacroTile key={m.key} stat={m} value={num(totals, m.nutrient)} />
            ))}
          </View>

          <Card style={styles.gap10}>
            <View style={styles.rowBetween}>
              <View style={styles.inline}>
                <Icon name="heart-outline" size={17} color={colors.text} />
                <T variant="label">Health score</T>
              </View>
              <T variant="label">{score ?? '–'}/10</T>
            </View>
            <ProgressBar value={(score ?? 0) / 10} color={healthScoreColor(score)} height={7} />
            <T variant="caption">{healthScoreNote(score)}</T>
          </Card>

          <GlucoseCard log={log} />

          <View style={styles.rowBetween}>
            <T variant="heading">Ingredients</T>
            <Pressable accessibilityRole="button" onPress={() => setFixOpen(true)} hitSlop={8}>
              <T variant="label" color={colors.textMuted}>
                + Add more
              </T>
            </Pressable>
          </View>
          <View style={styles.ingredients}>
            {log.foods.map((food, index) => (
              <Pressable
                key={`${food.food_id}-${index}`}
                accessibilityRole="button"
                onPress={() => setEditing(index)}
                style={({ pressed }) => [styles.ingredient, pressed && styles.pressed]}>
                <View style={styles.flex}>
                  <T variant="label" numberOfLines={1}>
                    {capitalize(food.name ?? 'Food')}
                  </T>
                  <T variant="caption" numberOfLines={1}>
                    {servingLabel(loggedAmount(food), food.serving.unit)}
                    {food.brand_name ? ` · ${food.brand_name}` : ''}
                  </T>
                </View>
                <T variant="label">{Math.round(num(food.nutrients, 'calories'))} cal</T>
                <Icon name="create-outline" size={17} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
          {meta?.unmatched?.length ? (
            <T variant="caption">
              Not matched to January’s database (not counted): {meta.unmatched.join(', ')}. Use Fix results to swap them in.
            </T>
          ) : null}

          <NutrientList nutrients={totals} />
          {mainFood?.food_id ? (
            <HealthierSwaps foodId={mainFood.food_id} foodName={capitalize(mainFood.name ?? 'this food')} />
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button variant="secondary" icon="sparkles-outline" title="Fix results" onPress={() => setFixOpen(true)} style={styles.flex} />
        <Button title="Done" onPress={goBack} style={styles.flex} />
      </View>

      <FixSheet visible={fixOpen} onClose={() => setFixOpen(false)} log={log} />
      <IngredientSheet
        food={editingFood}
        onClose={() => setEditing(null)}
        onSave={(quantity) => {
          if (editing === null) return;
          const foods = logToSelections(log).map((f, i) => (i === editing ? { ...f, quantity } : f));
          setEditing(null);
          void saveFoods(foods, 'Ingredient updated');
        }}
        onRemove={() => {
          if (editing === null) return;
          if (log.foods.length === 1) {
            setEditing(null);
            void remove();
            return;
          }
          const foods = logToSelections(log).filter((_, i) => i !== editing);
          setEditing(null);
          void saveFoods(foods, 'Ingredient removed');
        }}
      />
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Button variant="muted" icon="repeat-outline" title="Log again today" onPress={logAgain} />
        <Button variant="danger" icon="trash-outline" title="Delete meal" onPress={remove} />
      </Sheet>
    </View>
  );
}

const FIX_EXAMPLES = ['The portion was bigger', 'Add a latte with oat milk', 'There was no sauce'];

/** "Fix results": January re-estimates the meal from a plain-English correction. */
function FixSheet({ visible, onClose, log }: { visible: boolean; onClose: () => void; log: FoodLog }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const patchMeta = useApp((s) => s.patchMeta);

  const submit = async () => {
    const instruction = text.trim();
    if (!instruction || !log.id) return;
    setBusy(true);
    try {
      const corrected = await january.correctAnalysis(logAsAnalysis(log), instruction);
      const { selections, portions, unmatched } = analysisToSelections(corrected, servingSizes(log));
      if (!selections.length) throw new Error('That correction left no foods. Try wording it differently.');
      const name = corrected.meal_name?.trim();
      await updateLog(log.id, { foods: selections, name: name ? name.slice(0, 256) : undefined }, portions);
      patchMeta(log.id, { multiplier: 1, unmatched: unmatched.length ? unmatched : undefined });
      showToast('Meal updated');
      setText('');
      onClose();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Fix results">
      <T variant="caption" align="center">
        Tell January AI what’s off and it will re-estimate the meal.
      </T>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        placeholder="e.g. There were 3 eggs, and the toast had no butter"
        placeholderTextColor={colors.textFaint}
        style={styles.fixInput}
      />
      <View style={styles.fixExamples}>
        {FIX_EXAMPLES.map((e) => (
          <Chip key={e} label={e} onPress={() => setText(e)} />
        ))}
      </View>
      <Button title="Update" icon="sparkles" loading={busy} disabled={!text.trim()} onPress={submit} />
    </Sheet>
  );
}

function IngredientSheet({
  food,
  onClose,
  onSave,
  onRemove,
}: {
  food: LoggedFood | undefined;
  onClose: () => void;
  onSave: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <Sheet visible={!!food} onClose={onClose} title={food ? capitalize(food.name ?? 'Ingredient') : undefined}>
      {food ? <IngredientEditor key={`${food.food_id}-${food.quantity}`} food={food} onSave={onSave} onRemove={onRemove} /> : null}
    </Sheet>
  );
}

function IngredientEditor({
  food,
  onSave,
  onRemove,
}: {
  food: LoggedFood;
  onSave: (quantity: number) => void;
  onRemove: () => void;
}) {
  const original = food.quantity ?? 1;
  const [quantity, setQuantity] = useState(original);
  const perServing = num(food.nutrients, 'calories') / (original || 1);
  // The stepper counts servings but shows the amount, so 0.4 of a 100 g serving reads 40 (g).
  const size = food.serving.quantity || 1;
  return (
    <View style={styles.editor}>
      <View style={styles.rowBetween}>
        <View>
          <T variant="caption">Amount ({food.serving.unit ?? 'serving'})</T>
          <T variant="heading">{Math.round(perServing * quantity)} cal</T>
        </View>
        <Stepper
          value={quantity}
          onChange={setQuantity}
          step={0.25}
          min={0.25}
          max={50}
          format={(q) => formatQty(q * size)}
        />
      </View>
      <Button title="Save" disabled={quantity === original} onPress={() => onSave(quantity)} />
      <Button variant="danger" icon="trash-outline" title="Remove ingredient" onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  scroll: { paddingBottom: 24 },
  flex: { flex: 1 },
  hero: { height: 320, backgroundColor: '#EFEBE3' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  sheet: {
    marginTop: -28,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  gap10: { gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ingredients: { gap: 8 },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.85 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fixInput: {
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    textAlignVertical: 'top',
  },
  fixExamples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editor: { gap: 12 },
});
