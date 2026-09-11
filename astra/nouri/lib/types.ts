import type { components } from "./january-schema";
type S = components["schemas"];
export type Food = S["Food"];
export type Serving = S["FoodServing"];
export type Nutrients = S["Nutrients"];
export type Analysis = S["FoodAnalysisResult"];
export type DetectionServing = S["DetectionServing"];
export type Selection = S["FoodSelection"];
export type FoodLog = S["FoodLog"];
export type Prediction = S["GlucosePrediction"];
export type Credits = S["CreditBalance"];
export type Alternative = S["AlternativeFood"];
export type FoodSuggestion = S["FoodSuggestion"];
export type Profile = {
  sex: "male" | "female";
  age: number;
  height: number;
  weight: number;
  goal: "lose" | "maintain" | "gain";
  pace: "gentle" | "steady";
  activity:
    "sedentary" | "lightly_active" | "moderately_active" | "very_active";
  diet:
    | "balanced"
    | "vegetarian"
    | "vegan"
    | "pescatarian"
    | "high_protein"
    | "low_carbohydrate";
};
export type Targets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Ingredient = {
  food: Food;
  servingId: string;
  quantity: number;
  nutrients: Nutrients;
};
export type Meal = {
  localId: string;
  name: string;
  eatenAt: string;
  photo?: string;
  source: string;
  status: "analyzing" | "ready" | "error" | "uncertain";
  log?: FoodLog;
  analysis?: Analysis;
  ingredients: Ingredient[];
  nutrients: Nutrients;
  prediction?: Prediction;
  predictionProfile?: string;
  error?: string;
  warning?: string;
};
export type Journal = {
  water?: import("./water").WaterState;
  profile: Profile | null;
  targets: Targets | null;
  meals: Meal[];
  weights: { date: string; value: number }[];
};
