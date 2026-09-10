import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GetApiKeyButton } from '@/components/api-key-button';
import { Icon, type IconName } from '@/components/icons';
import { NumberField } from '@/components/number-field';
import { Sheet } from '@/components/sheet';
import { Button, Card, ProgressBar, Segmented, T } from '@/components/ui';
import { APP_NAME, colors, radius } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { clearImages } from '@/lib/images';
import { errorMessage, isApiKeyError } from '@/lib/january/client';
import { capitalize } from '@/lib/january/mapping';
import {
  ageFromBirthdate,
  CM_PER_IN,
  computeTargets,
  type Condition,
  type Diet,
  formatHeight,
  formatWeight,
  type Goal,
  kgToLb,
  lbToKg,
  type Profile,
  type Sex,
  type Targets,
  type Workouts,
} from '@/lib/nutrition';
import { queryClient, useCredits } from '@/lib/queries';
import { showToast, useApp } from '@/lib/store';

type Editor =
  | {
      kind: 'options';
      title: string;
      value: string;
      options: { value: string; label: string }[];
      save: (value: string) => void;
    }
  | {
      kind: 'number';
      title: string;
      value: number;
      unit: string;
      step: number;
      min: number;
      max: number;
      decimals?: number;
      save: (value: number) => void;
    };

const THIS_YEAR = new Date().getFullYear();
const GOAL_LABEL: Record<Goal, string> = { lose: 'Lose weight', maintain: 'Maintain', gain: 'Gain weight' };
const WORKOUT_LABEL: Record<Workouts, string> = { '0-2': '0–2 per week', '3-5': '3–5 per week', '6+': '6+ per week' };
const CONDITION_LABEL: Record<Condition, string> = {
  none: 'None',
  prediabetes: 'Prediabetes',
  type_2_diabetes: 'Type 2 diabetes',
  type_1_diabetes: 'Type 1 diabetes',
};
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

function detailRows(
  profile: Profile,
  updateProfile: (patch: Partial<Profile>) => void,
  logWeight: (kg: number) => void,
): { icon: IconName; label: string; value: string; editor: Editor }[] {
  const imperial = profile.units === 'imperial';
  const weightUnit = imperial ? 'lb' : 'kg';
  const toUnit = (kg: number) => (imperial ? Math.round(kgToLb(kg)) : Math.round(kg * 10) / 10);
  const fromUnit = (v: number) => (imperial ? lbToKg(v) : v);
  const weightField = { unit: weightUnit, step: imperial ? 1 : 0.5, decimals: imperial ? 0 : 1, min: imperial ? 60 : 30, max: imperial ? 700 : 320 };
  const rows: { icon: IconName; label: string; value: string; editor: Editor }[] = [
    {
      icon: 'person-outline',
      label: 'Sex',
      value: capitalize(profile.sex),
      editor: {
        kind: 'options',
        title: 'Biological sex',
        value: profile.sex,
        options: toOptions({ male: 'Male', female: 'Female' }),
        save: (v) => updateProfile({ sex: v as Sex }),
      },
    },
    {
      icon: 'calendar-outline',
      label: 'Age',
      value: String(ageFromBirthdate(profile.birthdate)),
      editor: {
        kind: 'number',
        title: 'Birth year',
        value: Number(profile.birthdate.slice(0, 4)),
        unit: '',
        step: 1,
        min: THIS_YEAR - 100,
        max: THIS_YEAR - 13,
        save: (year) => updateProfile({ birthdate: `${year}${profile.birthdate.slice(4)}` }),
      },
    },
    {
      icon: 'body-outline',
      label: 'Height',
      value: formatHeight(profile.heightCm, profile.units),
      editor: {
        kind: 'number',
        title: 'Height',
        value: imperial ? Math.round(profile.heightCm / CM_PER_IN) : Math.round(profile.heightCm),
        unit: imperial ? 'in' : 'cm',
        step: 1,
        min: imperial ? 36 : 100,
        max: imperial ? 96 : 250,
        save: (v) => updateProfile({ heightCm: imperial ? v * CM_PER_IN : v }),
      },
    },
    {
      icon: 'scale-outline',
      label: 'Current weight',
      value: formatWeight(profile.weightKg, profile.units, imperial ? 0 : 1),
      editor: { kind: 'number', title: 'Current weight', value: toUnit(profile.weightKg), ...weightField, save: (v) => logWeight(fromUnit(v)) },
    },
    {
      icon: 'trending-down',
      label: 'Goal',
      value: GOAL_LABEL[profile.goal],
      editor: {
        kind: 'options',
        title: 'Goal',
        value: profile.goal,
        options: toOptions(GOAL_LABEL),
        save: (v) => updateProfile({ goal: v as Goal, paceKg: v === 'maintain' ? 0 : profile.paceKg || 0.5 }),
      },
    },
  ];
  if (profile.goal !== 'maintain') {
    rows.push(
      {
        icon: 'trophy-outline',
        label: 'Goal weight',
        value: formatWeight(profile.targetWeightKg, profile.units, imperial ? 0 : 1),
        editor: {
          kind: 'number',
          title: 'Goal weight',
          value: toUnit(profile.targetWeightKg),
          ...weightField,
          save: (v) => updateProfile({ targetWeightKg: fromUnit(v) }),
        },
      },
      {
        icon: 'speedometer-outline',
        label: 'Weekly pace',
        value: `${(imperial ? kgToLb(profile.paceKg) : profile.paceKg).toFixed(1)} ${imperial ? 'lbs' : 'kg'}`,
        editor: {
          kind: 'number',
          title: 'Weekly pace',
          value: Math.round((imperial ? kgToLb(profile.paceKg) : profile.paceKg) * 10) / 10,
          unit: imperial ? 'lb' : 'kg',
          step: 0.1,
          decimals: 1,
          min: imperial ? 0.2 : 0.1,
          max: imperial ? 3 : 1.5,
          save: (v) => updateProfile({ paceKg: imperial ? lbToKg(v) : v }),
        },
      },
    );
  }
  rows.push(
    {
      icon: 'barbell-outline',
      label: 'Workouts',
      value: WORKOUT_LABEL[profile.workouts],
      editor: {
        kind: 'options',
        title: 'Workouts per week',
        value: profile.workouts,
        options: toOptions(WORKOUT_LABEL),
        save: (v) => updateProfile({ workouts: v as Workouts }),
      },
    },
    {
      icon: 'restaurant-outline',
      label: 'Diet',
      value: capitalize(profile.diet),
      editor: {
        kind: 'options',
        title: 'Diet',
        value: profile.diet,
        options: toOptions({ classic: 'Classic', pescatarian: 'Pescatarian', vegetarian: 'Vegetarian', vegan: 'Vegan' }),
        save: (v) => updateProfile({ diet: v as Diet }),
      },
    },
    {
      icon: 'medkit-outline',
      label: 'Health condition',
      value: CONDITION_LABEL[profile.condition],
      editor: {
        kind: 'options',
        title: 'Health condition',
        value: profile.condition,
        options: toOptions(CONDITION_LABEL),
        save: (v) => updateProfile({ condition: v as Condition }),
      },
    },
  );
  return rows;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useApp((s) => s.profile);
  const targets = useApp((s) => s.targets);
  const updateProfile = useApp((s) => s.updateProfile);
  const logWeight = useApp((s) => s.logWeight);
  const resetAll = useApp((s) => s.resetAll);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  if (!profile || !targets) return null;

  const startOver = async () => {
    const ok = await confirmAction(
      'Start over?',
      'This clears your profile, goals and photos on this device and starts you as a new January end user. Meals already saved stay in the January account.',
      'Start over',
      true,
    );
    if (!ok) return;
    await clearImages();
    queryClient.clear();
    resetAll();
  };

  const plan = [
    { label: 'Calories', value: String(targets.calories), color: colors.text },
    { label: 'Protein', value: `${targets.protein}g`, color: colors.protein },
    { label: 'Carbs', value: `${targets.carbs}g`, color: colors.carbs },
    { label: 'Fats', value: `${targets.fat}g`, color: colors.fat },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}>
        <T variant="title">Settings</T>

        <Card onPress={() => setGoalsOpen(true)} style={styles.gap12}>
          <View style={styles.rowBetween}>
            <T variant="label">Daily nutrition goals</T>
            <View style={styles.inline}>
              <T variant="caption">Edit</T>
              <Icon name="chevron-forward" size={16} color={colors.textFaint} />
            </View>
          </View>
          <View style={styles.planRow}>
            {plan.map((p) => (
              <View key={p.label} style={styles.planItem}>
                <View style={[styles.planDot, { backgroundColor: p.color }]} />
                <T style={styles.planValue}>{p.value}</T>
                <T variant="caption">{p.label}</T>
              </View>
            ))}
          </View>
        </Card>

        <T variant="label" style={styles.section}>
          Personal details
        </T>
        <Card style={styles.list}>
          {detailRows(profile, updateProfile, logWeight).map((row, i) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              onPress={() => setEditor(row.editor)}
              style={({ pressed }) => [styles.listRow, i > 0 && styles.divider, pressed && styles.pressed]}>
              <Icon name={row.icon} size={19} color={colors.textMuted} />
              <T style={styles.flex}>{row.label}</T>
              <T variant="label">{row.value}</T>
              <Icon name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          ))}
        </Card>

        <T variant="label" style={styles.section}>
          Preferences
        </T>
        <Card style={styles.gap12}>
          <T variant="caption">Units</T>
          <Segmented
            options={[
              { value: 'imperial', label: 'Imperial (lb, ft)' },
              { value: 'metric', label: 'Metric (kg, cm)' },
            ]}
            value={profile.units}
            onChange={(units) => updateProfile({ units })}
          />
        </Card>

        <T variant="label" style={styles.section}>
          January AI
        </T>
        <ApiCard />

        <Button variant="danger" icon="log-out-outline" title="Start over" onPress={startOver} style={styles.section} />
        <T variant="caption" align="center">
          {APP_NAME} is a Cal AI-style demo built on January AI’s partner API. Estimates aren’t medical advice.
        </T>
      </ScrollView>

      <Sheet visible={!!editor} onClose={() => setEditor(null)} title={editor?.title}>
        {editor ? <EditorBody key={editor.title} editor={editor} onDone={() => setEditor(null)} /> : null}
      </Sheet>
      <Sheet visible={goalsOpen} onClose={() => setGoalsOpen(false)} title="Nutrition goals">
        {goalsOpen ? <GoalsForm profile={profile} targets={targets} onDone={() => setGoalsOpen(false)} /> : null}
      </Sheet>
    </View>
  );
}

function EditorBody({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  if (editor.kind === 'number') return <NumberEditor editor={editor} onDone={onDone} />;
  return (
    <View style={styles.options}>
      {editor.options.map((o) => {
        const selected = o.value === editor.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              editor.save(o.value);
              onDone();
            }}
            style={[styles.option, selected && styles.optionSelected]}>
            <T variant="label" color={selected ? '#FFFFFF' : colors.text}>
              {o.label}
            </T>
            {selected ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberEditor({ editor, onDone }: { editor: Extract<Editor, { kind: 'number' }>; onDone: () => void }) {
  const [value, setValue] = useState(editor.value);
  return (
    <>
      <NumberField
        big
        value={value}
        onChange={setValue}
        unit={editor.unit}
        step={editor.step}
        min={editor.min}
        max={editor.max}
        decimals={editor.decimals ?? 0}
      />
      <Button
        title="Save"
        onPress={() => {
          editor.save(value);
          onDone();
        }}
      />
    </>
  );
}

function GoalsForm({ profile, targets, onDone }: { profile: Profile; targets: Targets; onDone: () => void }) {
  const setTargets = useApp((s) => s.setTargets);
  const [draft, setDraft] = useState(targets);
  const set = (patch: Partial<Targets>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <ScrollView contentContainerStyle={styles.gap10}>
      <NumberField label="Calories" value={draft.calories} unit="kcal" step={10} min={1000} max={6000} onChange={(calories) => set({ calories })} />
      <NumberField label="Protein" value={draft.protein} unit="g" step={5} min={20} max={400} onChange={(protein) => set({ protein })} />
      <NumberField label="Carbs" value={draft.carbs} unit="g" step={5} min={20} max={800} onChange={(carbs) => set({ carbs })} />
      <NumberField label="Fats" value={draft.fat} unit="g" step={5} min={10} max={300} onChange={(fat) => set({ fat })} />
      <Button variant="muted" icon="sparkles-outline" title="Auto-generate from my profile" onPress={() => setDraft(computeTargets(profile))} />
      <Button
        title="Save goals"
        onPress={() => {
          setTargets(draft);
          showToast('Goals updated');
          onDone();
        }}
      />
    </ScrollView>
  );
}

/** Connection status and the partner account's credit balance (GET /credits is free). */
function ApiCard() {
  const credits = useCredits();
  const endUserId = useApp((s) => s.endUserId);
  const data = credits.data;
  const keyProblem = isApiKeyError(credits.error);
  const status = data
    ? { label: 'Connected', color: colors.success }
    : credits.error
      ? { label: keyProblem ? 'Not connected' : 'Error', color: colors.danger }
      : { label: 'Checking…', color: colors.textMuted };

  return (
    <Card style={styles.gap10}>
      <View style={styles.rowBetween}>
        <View style={styles.inline}>
          <Icon name="key-outline" size={18} color={colors.text} />
          <T variant="label">Partner API</T>
        </View>
        <View style={[styles.badge, { backgroundColor: `${status.color}1F` }]}>
          <T style={[styles.badgeText, { color: status.color }]}>{status.label}</T>
        </View>
      </View>
      {data ? (
        <>
          {data.included_credits ? <ProgressBar value={data.used_credits / data.included_credits} /> : null}
          <T variant="caption">
            {data.remaining_credits != null && data.included_credits != null
              ? `${data.remaining_credits.toLocaleString()} of ${data.included_credits.toLocaleString()} credits left`
              : `${data.used_credits.toLocaleString()} credits used`}
            {` · ${capitalize(data.plan)} plan · resets ${new Date(data.resets_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
          </T>
        </>
      ) : credits.error ? (
        <>
          <T variant="caption">{errorMessage(credits.error)}</T>
          {keyProblem ? <GetApiKeyButton style={styles.alignStart} /> : null}
        </>
      ) : null}
      <T variant="caption" selectable>
        End-user ID: {endUserId}
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
  flex: { flex: 1 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  section: { marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alignStart: { alignSelf: 'flex-start' },
  planRow: { flexDirection: 'row', justifyContent: 'space-between' },
  planItem: { alignItems: 'center', gap: 2, flex: 1 },
  planDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  planValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  list: { paddingVertical: 4, paddingHorizontal: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  optionSelected: { backgroundColor: colors.primary },
});
