import { Redirect } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName, MIcon, type MIconName } from '@/components/icons';
import { NumberField } from '@/components/number-field';
import { Ring } from '@/components/ring';
import { ScanFrame } from '@/components/scan-frame';
import { Slider } from '@/components/slider';
import { Button, IconButton, ProgressBar, Segmented, T } from '@/components/ui';
import { APP_NAME, colors, radius, shadow } from '@/constants/theme';
import { formatMonthDay } from '@/lib/dates';
import {
  CM_PER_IN,
  computeTargets,
  type Condition,
  type Diet,
  formatWeight,
  type Goal,
  goalDate,
  kgToLb,
  lbToKg,
  type Profile,
  type Sex,
  type Units,
  type Workouts,
} from '@/lib/nutrition';
import { useApp } from '@/lib/store';

type Draft = {
  sex: Sex | null;
  workouts: Workouts | null;
  units: Units;
  heightCm: number;
  weightKg: number;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  goal: Goal | null;
  targetWeightKg: number;
  paceKg: number;
  diet: Diet | null;
  condition: Condition | null;
};

type StepId =
  | 'welcome'
  | 'sex'
  | 'workouts'
  | 'body'
  | 'birthday'
  | 'goal'
  | 'target'
  | 'pace'
  | 'diet'
  | 'condition'
  | 'generating'
  | 'plan';

const QUESTIONS: StepId[] = ['sex', 'workouts', 'body', 'birthday', 'goal', 'target', 'pace', 'diet', 'condition'];

const stepsFor = (goal: Goal | null): StepId[] => [
  'welcome',
  ...QUESTIONS.filter((s) => goal !== 'maintain' || (s !== 'target' && s !== 'pace')),
  'generating',
  'plan',
];

const COPY: Partial<Record<StepId, { title: string; subtitle?: string }>> = {
  sex: { title: 'What’s your biological sex?', subtitle: 'Used to estimate your metabolism and predict blood sugar responses.' },
  workouts: { title: 'How many workouts do you do per week?', subtitle: 'This will be used to calibrate your custom plan.' },
  body: { title: 'Height & weight', subtitle: 'This will be used to calibrate your custom plan.' },
  birthday: { title: 'When were you born?', subtitle: 'This will be used to calibrate your custom plan.' },
  goal: { title: 'What is your goal?', subtitle: 'This helps us generate a plan for your calorie intake.' },
  target: { title: 'What is your desired weight?' },
  pace: { title: 'How fast do you want to reach your goal?' },
  diet: { title: 'Do you follow a specific diet?', subtitle: 'Healthier swaps will respect it.' },
  condition: {
    title: 'Do any of these apply to you?',
    subtitle: 'January AI uses this to predict how each meal affects your blood sugar.',
  },
};

type Option<V> = { value: V; label: string; hint?: string; icon?: IconName; micon?: MIconName };

const SEX_OPTIONS: Option<Sex>[] = [
  { value: 'male', label: 'Male', icon: 'male' },
  { value: 'female', label: 'Female', icon: 'female' },
];
const WORKOUT_OPTIONS: Option<Workouts>[] = [
  { value: '0-2', label: '0–2', hint: 'Workouts now and then', icon: 'body-outline' },
  { value: '3-5', label: '3–5', hint: 'A few workouts per week', icon: 'barbell-outline' },
  { value: '6+', label: '6+', hint: 'Dedicated athlete', icon: 'trophy-outline' },
];
const GOAL_OPTIONS: Option<Goal>[] = [
  { value: 'lose', label: 'Lose weight', icon: 'trending-down' },
  { value: 'maintain', label: 'Maintain', icon: 'remove-outline' },
  { value: 'gain', label: 'Gain weight', icon: 'trending-up' },
];
const DIET_OPTIONS: Option<Diet>[] = [
  { value: 'classic', label: 'Classic', micon: 'food-steak' },
  { value: 'pescatarian', label: 'Pescatarian', micon: 'fish' },
  { value: 'vegetarian', label: 'Vegetarian', micon: 'carrot' },
  { value: 'vegan', label: 'Vegan', micon: 'sprout' },
];
const CONDITION_OPTIONS: Option<Condition>[] = [
  { value: 'none', label: 'None of these' },
  { value: 'prediabetes', label: 'Prediabetes' },
  { value: 'type_2_diabetes', label: 'Type 2 diabetes' },
  { value: 'type_1_diabetes', label: 'Type 1 diabetes', hint: 'Glucose predictions aren’t available' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const THIS_YEAR = new Date().getFullYear();
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const pad = (n: number) => String(n).padStart(2, '0');

const INITIAL: Draft = {
  sex: null,
  workouts: null,
  units: 'imperial',
  heightCm: 170,
  weightKg: lbToKg(165),
  birthYear: THIS_YEAR - 30,
  birthMonth: 1,
  birthDay: 1,
  goal: null,
  targetWeightKg: lbToKg(155),
  paceKg: lbToKg(1.5),
  diet: null,
  condition: null,
};

function toProfile(d: Draft): Profile {
  const maintain = d.goal === 'maintain';
  return {
    sex: d.sex ?? 'female',
    birthdate: `${d.birthYear}-${pad(d.birthMonth)}-${pad(Math.min(d.birthDay, daysInMonth(d.birthYear, d.birthMonth)))}`,
    heightCm: Math.round(d.heightCm * 10) / 10,
    weightKg: Math.round(d.weightKg * 10) / 10,
    targetWeightKg: Math.round((maintain ? d.weightKg : d.targetWeightKg) * 10) / 10,
    paceKg: maintain ? 0 : Math.round(d.paceKg * 100) / 100,
    goal: d.goal ?? 'maintain',
    workouts: d.workouts ?? '3-5',
    diet: d.diet ?? 'classic',
    condition: d.condition ?? 'none',
    units: d.units,
  };
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const onboarded = useApp((s) => s.onboarded);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [index, setIndex] = useState(0);

  if (onboarded) return <Redirect href="/" />;

  const steps = stepsFor(draft.goal);
  const step = steps[Math.min(index, steps.length - 1)];
  const questionSteps = steps.filter((s) => QUESTIONS.includes(s));
  const questionIndex = questionSteps.indexOf(step);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const profile = toProfile(draft);

  const setGoal = (goal: Goal) =>
    set({
      goal,
      targetWeightKg: goal === 'gain' ? draft.weightKg + 4.5 : draft.weightKg - 4.5,
      paceKg: goal === 'gain' ? lbToKg(0.8) : lbToKg(1.5),
    });

  const valid = (() => {
    switch (step) {
      case 'sex':
        return !!draft.sex;
      case 'workouts':
        return !!draft.workouts;
      case 'goal':
        return !!draft.goal;
      case 'target':
        return draft.goal === 'lose'
          ? draft.targetWeightKg < draft.weightKg - 0.4
          : draft.targetWeightKg > draft.weightKg + 0.4;
      case 'diet':
        return !!draft.diet;
      case 'condition':
        return !!draft.condition;
      case 'birthday': {
        const age = THIS_YEAR - draft.birthYear;
        return age >= 13 && age <= 100;
      }
      default:
        return true;
    }
  })();

  const next = () => {
    if (step === 'plan') completeOnboarding(profile, computeTargets(profile));
    else setIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const copy = COPY[step];
  const imperial = draft.units === 'imperial';

  let content: ReactNode = null;
  switch (step) {
    case 'welcome':
      content = <Welcome />;
      break;
    case 'sex':
      content = <Options options={SEX_OPTIONS} value={draft.sex} onChange={(sex) => set({ sex })} />;
      break;
    case 'workouts':
      content = <Options options={WORKOUT_OPTIONS} value={draft.workouts} onChange={(workouts) => set({ workouts })} />;
      break;
    case 'goal':
      content = <Options options={GOAL_OPTIONS} value={draft.goal} onChange={setGoal} />;
      break;
    case 'diet':
      content = <Options options={DIET_OPTIONS} value={draft.diet} onChange={(diet) => set({ diet })} />;
      break;
    case 'condition':
      content = <Options options={CONDITION_OPTIONS} value={draft.condition} onChange={(condition) => set({ condition })} />;
      break;
    case 'body': {
      const totalIn = Math.round(draft.heightCm / CM_PER_IN);
      const ft = Math.floor(totalIn / 12);
      const inch = totalIn % 12;
      content = (
        <View style={styles.stack}>
          <Segmented
            options={[
              { value: 'imperial', label: 'Imperial' },
              { value: 'metric', label: 'Metric' },
            ]}
            value={draft.units}
            onChange={(units) => set({ units })}
          />
          {imperial ? (
            <>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <NumberField label="Height" value={ft} unit="ft" min={3} max={8} onChange={(v) => set({ heightCm: (v * 12 + inch) * CM_PER_IN })} />
                </View>
                <View style={styles.flex}>
                  <NumberField label=" " value={inch} unit="in" min={0} max={11} onChange={(v) => set({ heightCm: (ft * 12 + v) * CM_PER_IN })} />
                </View>
              </View>
              <NumberField label="Weight" value={Math.round(kgToLb(draft.weightKg))} unit="lb" min={60} max={700} onChange={(v) => set({ weightKg: lbToKg(v) })} />
            </>
          ) : (
            <>
              <NumberField label="Height" value={Math.round(draft.heightCm)} unit="cm" min={100} max={250} onChange={(v) => set({ heightCm: v })} />
              <NumberField label="Weight" value={Math.round(draft.weightKg)} unit="kg" min={30} max={320} onChange={(v) => set({ weightKg: v })} />
            </>
          )}
        </View>
      );
      break;
    }
    case 'birthday': {
      const setDate = (year: number, month: number, day: number) =>
        set({ birthYear: year, birthMonth: month, birthDay: Math.min(day, daysInMonth(year, month)) });
      content = (
        <View style={styles.stack}>
          <View style={styles.row}>
            <Wheel
              label="Month"
              value={MONTHS[draft.birthMonth - 1]}
              onUp={() => setDate(draft.birthYear, (draft.birthMonth % 12) + 1, draft.birthDay)}
              onDown={() => setDate(draft.birthYear, ((draft.birthMonth + 10) % 12) + 1, draft.birthDay)}
            />
            <Wheel
              label="Day"
              value={String(draft.birthDay)}
              onUp={() => setDate(draft.birthYear, draft.birthMonth, (draft.birthDay % daysInMonth(draft.birthYear, draft.birthMonth)) + 1)}
              onDown={() => {
                const max = daysInMonth(draft.birthYear, draft.birthMonth);
                setDate(draft.birthYear, draft.birthMonth, draft.birthDay <= 1 ? max : draft.birthDay - 1);
              }}
            />
          </View>
          <NumberField
            label="Year"
            value={draft.birthYear}
            unit=""
            min={THIS_YEAR - 100}
            max={THIS_YEAR - 13}
            onChange={(year) => setDate(year, draft.birthMonth, draft.birthDay)}
          />
        </View>
      );
      break;
    }
    case 'target': {
      const tooFar = !valid;
      content = (
        <View style={styles.stack}>
          <T variant="label" color={colors.textMuted} align="center">
            {draft.goal === 'lose' ? 'Lose weight' : 'Gain weight'}
          </T>
          <NumberField
            big
            value={Math.round(imperial ? kgToLb(draft.targetWeightKg) : draft.targetWeightKg)}
            unit={imperial ? 'lb' : 'kg'}
            min={imperial ? 60 : 30}
            max={imperial ? 700 : 320}
            onChange={(v) => set({ targetWeightKg: imperial ? lbToKg(v) : v })}
          />
          <T variant="caption" align="center" color={tooFar ? colors.danger : colors.textMuted}>
            {tooFar
              ? `Pick a weight ${draft.goal === 'lose' ? 'below' : 'above'} your current ${formatWeight(draft.weightKg, draft.units)}.`
              : `Currently ${formatWeight(draft.weightKg, draft.units)}`}
          </T>
        </View>
      );
      break;
    }
    case 'pace': {
      const display = imperial ? kgToLb(draft.paceKg) : draft.paceKg;
      const [min, max, rec] = imperial ? [0.2, 3, 1.5] : [0.1, 1.5, 0.7];
      const recommended = draft.goal === 'gain' ? display <= (imperial ? 1 : 0.5) : Math.abs(display - rec) <= rec * 0.35;
      const date = goalDate(profile);
      content = (
        <View style={styles.stack}>
          <T variant="label" color={colors.textMuted} align="center">
            {draft.goal === 'lose' ? 'Loss' : 'Gain'} speed per week
          </T>
          <T style={styles.bigValue} align="center">
            {display.toFixed(1)} {imperial ? 'lbs' : 'kg'}
          </T>
          <View style={styles.paceIcons}>
            <MIcon name="tortoise" size={28} color={display < rec * 0.6 ? colors.text : colors.textFaint} />
            <MIcon name="rabbit" size={28} color={recommended ? colors.text : colors.textFaint} />
            <MIcon name="run" size={28} color={display > rec * 1.4 ? colors.text : colors.textFaint} />
          </View>
          <Slider
            value={Math.round(display * 10) / 10}
            min={min}
            max={max}
            step={0.1}
            onChange={(v) => set({ paceKg: imperial ? lbToKg(v) : v })}
          />
          <View style={styles.paceLabels}>
            <T variant="caption">{min}</T>
            <T variant="caption">{rec}</T>
            <T variant="caption">{max}</T>
          </View>
          <View style={[styles.recommended, !recommended && styles.hidden]}>
            <T variant="label">Recommended</T>
          </View>
          {date ? (
            <T variant="caption" align="center">
              You’ll reach {formatWeight(draft.targetWeightKg, draft.units)} around {formatMonthDay(date)}.
            </T>
          ) : null}
        </View>
      );
      break;
    }
    case 'generating':
      content = <Generating onDone={next} />;
      break;
    case 'plan':
      content = <Plan profile={profile} />;
      break;
  }

  const showTopBar = step !== 'welcome' && step !== 'generating';
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      {showTopBar ? (
        <View style={styles.topBar}>
          <IconButton icon="chevron-back" label="Back" onPress={back} />
          <View style={styles.flex}>
            {questionIndex >= 0 ? <ProgressBar value={(questionIndex + 1) / questionSteps.length} height={4} /> : null}
          </View>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {copy ? (
          <View style={styles.copy}>
            <T variant="title">{copy.title}</T>
            {copy.subtitle ? <T color={colors.textMuted}>{copy.subtitle}</T> : null}
          </View>
        ) : null}
        {content}
      </ScrollView>
      {step !== 'generating' ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            title={step === 'welcome' ? 'Get started' : step === 'plan' ? 'Let’s get started!' : 'Continue'}
            disabled={!valid}
            onPress={next}
          />
        </View>
      ) : null}
    </View>
  );
}

function Options<V extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<V>[];
  value: V | null;
  onChange: (value: V) => void;
}) {
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        const fg = selected ? '#FFFFFF' : colors.text;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
            {o.icon || o.micon ? (
              <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                {o.icon ? <Icon name={o.icon} size={20} color={fg} /> : null}
                {o.micon ? <MIcon name={o.micon} size={20} color={fg} /> : null}
              </View>
            ) : null}
            <View style={styles.flex}>
              <T variant="label" color={fg} style={styles.optionLabel}>
                {o.label}
              </T>
              {o.hint ? <T variant="caption" color={selected ? 'rgba(255,255,255,0.72)' : colors.textMuted}>{o.hint}</T> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Wheel({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={styles.wheel}>
      <T variant="caption">{label}</T>
      <IconButton icon="chevron-up" label={`Next ${label.toLowerCase()}`} background={colors.surface} onPress={onUp} />
      <T style={styles.wheelValue} numberOfLines={1}>
        {value}
      </T>
      <IconButton icon="chevron-down" label={`Previous ${label.toLowerCase()}`} background={colors.surface} onPress={onDown} />
    </View>
  );
}

function Welcome() {
  return (
    <View style={styles.welcome}>
      <View style={styles.hero}>
        <View style={styles.heroScan}>
          <ScanFrame width={170} height={170} color="#FFFFFF" />
          <T style={styles.heroEmoji}>🥗</T>
        </View>
        <View style={styles.heroCard}>
          <T variant="label">Chicken salad</T>
          <View style={styles.heroStats}>
            <Icon name="flame" size={14} color={colors.text} />
            <T style={styles.heroKcal}>520 kcal</T>
            <MIcon name="food-drumstick" size={13} color={colors.protein} />
            <T variant="caption">38g</T>
            <MIcon name="barley" size={13} color={colors.carbs} />
            <T variant="caption">24g</T>
            <MIcon name="water" size={13} color={colors.fat} />
            <T variant="caption">29g</T>
          </View>
        </View>
      </View>
      <T variant="display" align="center">
        Calorie tracking{'\n'}made easy
      </T>
      <T color={colors.textMuted} align="center">
        Snap a photo of your meal. {APP_NAME} uses January AI to work out calories, macros and how it may affect your
        blood sugar.
      </T>
    </View>
  );
}

const CHECKLIST = ['Calories', 'Carbs', 'Protein', 'Fats', 'Health score'];

function Generating({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const started = Date.now();
    let finish: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - started) / 2600) * 100));
      setPct(p);
      if (p >= 100) {
        clearInterval(timer);
        finish = setTimeout(() => done.current(), 400);
      }
    }, 50);
    return () => {
      clearInterval(timer);
      clearTimeout(finish);
    };
  }, []);

  return (
    <View style={styles.generating}>
      <T style={styles.percent} align="center">
        {pct}%
      </T>
      <T variant="heading" align="center">
        We’re setting everything{'\n'}up for you
      </T>
      <ProgressBar value={pct / 100} height={8} color={colors.text} />
      <T variant="caption" align="center">
        {pct < 40 ? 'Applying BMR formula…' : pct < 80 ? 'Estimating your metabolic age…' : 'Finalizing results…'}
      </T>
      <View style={styles.checklist}>
        <T variant="label">Daily recommendation for</T>
        {CHECKLIST.map((item, i) => {
          const checked = pct >= (i + 1) * 18;
          return (
            <View key={item} style={styles.checkRow}>
              <T color={checked ? colors.text : colors.textMuted}>• {item}</T>
              {checked ? <Icon name="checkmark-circle" size={20} color={colors.text} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Plan({ profile }: { profile: Profile }) {
  const targets = computeTargets(profile);
  const date = goalDate(profile);
  const diff = Math.abs(profile.weightKg - profile.targetWeightKg);
  const tiles: { label: string; value: string; color: string; icon?: IconName; micon?: MIconName }[] = [
    { label: 'Calories', value: String(targets.calories), color: colors.text, icon: 'flame' },
    { label: 'Carbs', value: `${targets.carbs}g`, color: colors.carbs, micon: 'barley' },
    { label: 'Protein', value: `${targets.protein}g`, color: colors.protein, micon: 'food-drumstick' },
    { label: 'Fats', value: `${targets.fat}g`, color: colors.fat, micon: 'water' },
  ];
  return (
    <View style={styles.stack}>
      <View style={styles.checkBadge}>
        <Icon name="checkmark" size={26} color="#FFFFFF" />
      </View>
      <T variant="title" align="center">
        Congratulations{'\n'}your custom plan is ready!
      </T>
      <View style={styles.goalBlock}>
        <T variant="label" align="center">
          {date ? `You should ${profile.goal === 'lose' ? 'lose' : 'gain'}:` : 'Your goal:'}
        </T>
        <View style={styles.goalPill}>
          <T variant="label">
            {date
              ? `${formatWeight(diff, profile.units)} by ${formatMonthDay(date)}`
              : `Maintain ${formatWeight(profile.weightKg, profile.units)}`}
          </T>
        </View>
      </View>
      <View style={styles.planCard}>
        <T variant="heading">Daily recommendation</T>
        <T variant="caption">You can edit this anytime in Settings</T>
        <View style={styles.planGrid}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.planTile}>
              <View style={styles.planTileHeader}>
                {t.icon ? <Icon name={t.icon} size={15} color={t.color} /> : null}
                {t.micon ? <MIcon name={t.micon} size={15} color={t.color} /> : null}
                <T variant="caption">{t.label}</T>
              </View>
              <Ring size={78} stroke={7} progress={0.72} color={t.color}>
                <T variant="label">{t.value}</T>
              </Ring>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.tips}>
        <T variant="heading">How to reach your goals</T>
        {[
          ['scan-outline', 'Snap every meal. It takes a few seconds.'],
          ['pulse-outline', 'Check each meal’s blood sugar impact.'],
          ['nutrition-outline', 'Use health scores to improve your routine.'],
          ['flame-outline', 'Stay close to your daily calorie target.'],
        ].map(([icon, text]) => (
          <View key={text} style={styles.tip}>
            <View style={styles.tipIcon}>
              <Icon name={icon as IconName} size={18} color={colors.text} />
            </View>
            <T style={styles.flex}>{text}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingBottom: 6 },
  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24, gap: 26 },
  copy: { gap: 8 },
  footer: { paddingHorizontal: 22, paddingTop: 10 },
  stack: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  optionSelected: { backgroundColor: colors.primary },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: { backgroundColor: 'rgba(255,255,255,0.14)' },
  optionLabel: { fontSize: 16.5 },
  pressed: { opacity: 0.85 },
  wheel: { flex: 1, alignItems: 'center', gap: 10, backgroundColor: colors.muted, borderRadius: radius.lg, paddingVertical: 14 },
  wheelValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  bigValue: { fontSize: 44, lineHeight: 52, fontWeight: '800', letterSpacing: -1, color: colors.text },
  paceIcons: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  paceLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  recommended: {
    alignSelf: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hidden: { opacity: 0 },
  welcome: { gap: 18, alignItems: 'center', paddingTop: 8 },
  hero: {
    width: '100%',
    height: 300,
    borderRadius: radius.xl,
    backgroundColor: '#1C1C20',
    alignItems: 'center',
    paddingTop: 30,
    overflow: 'hidden',
  },
  heroScan: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { position: 'absolute', fontSize: 84, lineHeight: 100 },
  heroCard: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    gap: 6,
    boxShadow: shadow.raised,
  },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroKcal: { fontSize: 13, fontWeight: '700', color: colors.text, marginRight: 6 },
  generating: { gap: 18, paddingTop: 40 },
  percent: { fontSize: 64, lineHeight: 72, fontWeight: '800', letterSpacing: -2, color: colors.text },
  checklist: { backgroundColor: colors.muted, borderRadius: radius.lg, padding: 18, gap: 10, marginTop: 10 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkBadge: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBlock: { gap: 8, alignItems: 'center' },
  goalPill: { backgroundColor: colors.muted, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  planCard: { backgroundColor: colors.muted, borderRadius: radius.xl, padding: 18, gap: 4 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  planTile: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  planTileHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  tips: { gap: 12 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
