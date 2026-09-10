// Types for the January v1.2 partner API (https://partners.january.ai), taken from its OpenAPI document.
// Ids are opaque strings; nutrient maps are sparse (a missing key means "no value", not zero).

export type NutrientKey =
  | 'calories'
  | 'protein'
  | 'carbohydrates'
  | 'net_carbohydrates'
  | 'total_fat'
  | 'trans_fat'
  | 'saturated_fat'
  | 'fiber'
  | 'total_sugars'
  | 'added_sugars'
  | 'cholesterol'
  | 'calcium'
  | 'iron'
  | 'potassium'
  | 'sodium'
  | 'vitamin_d';

export type NutrientAmount = { value: number; unit: string };
export type Nutrients = Partial<Record<NutrientKey, NutrientAmount>>;

export type FoodServing = {
  id: string | null;
  quantity: number | null;
  unit: string | null;
  /** Multiplier applied to the food's (primary-serving) nutrition for this serving. */
  scaling_factor: number | null;
  weight_grams: number | null;
  is_primary: boolean | null;
};

export type Food = {
  id: string;
  type: 'generic' | 'branded' | 'recipe';
  name: string | null;
  brand_name: string | null;
  nutrients: Nutrients;
  glycemic_index: number | null;
  glycemic_load: number | null;
  image_url: string | null;
  barcode: string | null;
  /** Search and barcode results carry the primary serving only; GET /foods/{id} returns them all. */
  servings: FoodServing[];
};

export type DetectionServing = {
  id: string | null;
  quantity: number | null;
  unit: string | null;
  /** Parsed from text ("2 cups" → 2); null on image and corrected analyses. */
  selected_quantity: number | null;
};

export type DetectedFood = {
  id: string | null;
  name: string | null;
  brand_name: string | null;
  nutrients: Nutrients;
  servings: DetectionServing[];
};

export type Detection = { confidence: 'high' | 'medium' | 'low' | null; food: DetectedFood };

export type FoodAnalysisResult = {
  meal_name: string | null;
  total_nutrients: Nutrients;
  detections: Detection[];
};

export type FoodSelection = { food_id: string; serving_id: string; quantity: number };

export type ServingDetails = {
  id: string | null;
  quantity: number | null;
  unit: string | null;
  weight_grams: number | null;
};

export type LoggedFood = {
  food_id: string | null;
  name: string | null;
  brand_name: string | null;
  image_url: string | null;
  glycemic_index: number | null;
  glycemic_load: number | null;
  /** Scaled to the consumed quantity. */
  nutrients: Nutrients;
  /** How many of `serving` were eaten. */
  quantity: number | null;
  serving: ServingDetails;
};

export type FoodLog = {
  id: string | null;
  foods: LoggedFood[];
  /** UTC, with milliseconds. */
  eaten_at: string;
  name: string | null;
};

export type CreateFoodLogRequest = { foods: FoodSelection[]; eaten_at?: string; name?: string };
export type UpdateFoodLogRequest = Partial<CreateFoodLogRequest>;

export type DietPreference =
  | 'vegetarian'
  | 'vegan'
  | 'keto'
  | 'paleo'
  | 'pescatarian'
  | 'low_carbohydrate'
  | 'high_protein'
  | 'kosher'
  | 'halal';

export type AlternativeFood = {
  id: string | null;
  name: string | null;
  brand_name: string | null;
  nutrients: Nutrients;
  servings: { id: string | null; quantity: number | null; unit: string | null }[];
};

export type GlucoseUserProfile = {
  age: number;
  sex: 'male' | 'female';
  height: { value: number; unit: 'in' | 'cm' };
  weight: { value: number; unit: 'lb' | 'kg' };
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  health_conditions?: ('type_2_diabetes' | 'prediabetes')[];
};

export type GlucosePredictionRequest = {
  user_profile: GlucoseUserProfile;
  timezone: string;
  foods: FoodSelection[];
  start_time: string;
};

export type GlucosePrediction = {
  /** Predicted curve at 15-minute intervals after start_time, in mg/dL. */
  points: { minutes: number; value: number }[];
  impact_score: 'low' | 'medium' | 'high' | null;
  /** Suggested y-axis bounds (a target range, not the curve's extremes). */
  chart: { min: number | null; max: number | null };
};

export type CreditBalance = {
  plan: string;
  period_start: string;
  period_end: string;
  resets_at: string;
  included_credits: number | null;
  used_credits: number;
  remaining_credits: number | null;
};

export type ApiErrorBody = { message: string; code: string };
