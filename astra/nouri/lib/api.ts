import type { Analysis, Food, Ingredient, Nutrients } from "./types";
import { consistent, resolvePortion, sumNutrients } from "./domain";
import { errorAction, canRetry } from "./policy";
import { Platform } from "react-native";
import Constants from "expo-constants";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public retryable = false,
  ) {
    super(errorAction(code, status));
  }
}
export class NutritionMismatch extends Error {
  readonly code = "nutrition_mismatch";
  constructor() {
    super(
      "The detected portions do not match January’s nutrition total. Nothing was logged. Use Fix results with explicit amounts, or log ingredients through Search.",
    );
  }
}
function apiUrl() {
  if (Platform.OS === "web") return "/api/january";
  const origin =
    __DEV__ && Constants.expoConfig?.hostUri
      ? `http://${Constants.expoConfig.hostUri}`
      : Constants.expoConfig?.extra?.apiOrigin;
  if (!origin)
    throw new Error(
      "The app server is not configured. Set NOURI_API_ORIGIN to your deployed HTTPS server before building the native app.",
    );
  return `${String(origin).replace(/\/$/, "")}/api/january`;
}
export async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number>;
    userId?: string;
    etag?: string;
  } = {},
): Promise<{ data: T; etag: string | null }> {
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, ...options, method }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new ApiError("transport_error", 0, false);
  }
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("transport_error", response.status, false);
  }
  if (!response.ok)
    throw new ApiError(
      result.code ?? "invalid_request",
      response.status,
      canRetry(result.code, method, path),
    );
  return result;
}
const foodCache = new Map<string, Food>();
export function rememberFood(food: Food) {
  foodCache.set(food.id, food);
}
export async function getFood(id: string) {
  if (foodCache.has(id)) return foodCache.get(id)!;
  const { data } = await request<Food>(`/foods/${id}`);
  foodCache.set(id, data);
  return data;
}
export async function resolveAnalysis(
  analysis: Analysis,
): Promise<{ ingredients: Ingredient[]; nutrients: Nutrients }> {
  if (!analysis.detections.length)
    throw new Error(
      "No food was recognized. Take a clearer photo or describe the meal with amounts.",
    );
  const ingredients: Ingredient[] = [];
  // Deliberately sequential: no polling or repeated paid requests; repeated IDs use the catalog cache.
  for (const detection of analysis.detections) {
    if (!detection.food.id)
      throw new Error(
        "An ingredient has no catalog match. Use Fix results or add it through food search.",
      );
    const food = await getFood(detection.food.id);
    ingredients.push(resolvePortion(detection.food.servings[0]!, food));
  }
  const nutrients = sumNutrients(ingredients.map((i) => i.nutrients));
  if (!consistent(analysis.total_nutrients, nutrients))
    throw new NutritionMismatch();
  return { ingredients, nutrients };
}
