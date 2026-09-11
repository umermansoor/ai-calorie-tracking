const uuid =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export function allowedEndpoint(method: string, path: string): boolean {
  if (method === "GET")
    return /^\/(credits|foods|foods\/autocomplete|foods\/\d{1,16}|foods\/barcode\/\d{6,14}|food-logs)$/.test(
      path,
    );
  if (method === "POST")
    return /^\/(food-analysis\/(image|text|corrections)|foods\/\d{1,16}\/alternatives|food-logs|glucose\/predictions)$/.test(
      path,
    );
  return (
    ["PATCH", "DELETE"].includes(method) &&
    new RegExp(`^/food-logs/${uuid}$`).test(path)
  );
}
export function canRetry(code: string, method: string, path: string) {
  return (
    !(method === "POST" && path === "/food-logs") &&
    [
      "rate_limited",
      "internal_error",
      "upstream_error",
      "service_unavailable",
      "upstream_timeout",
    ].includes(code)
  );
}
export function errorAction(code: string, status?: number): string {
  const actions: Record<string, string> = {
    unauthorized:
      "Your January key is missing or rejected. Get a v1.2 key at developer.january.ai, set JANUARY_API_KEY on the server, and restart it.",
    forbidden:
      "This key cannot use January v1.2. Get a compatible key at developer.january.ai and update the server.",
    credit_limit_exceeded:
      "Your January credits are used up. Check Settings for the reset date or manage your plan at developer.january.ai.",
    rate_limited:
      "January is busy with your requests. Wait a minute, then try again.",
    not_found:
      "No matching food was found. Check the barcode, search by name, or photograph its nutrition label.",
    invalid_request:
      "January could not use those details. Check the amounts, include a clear food name, or use a sharper photo.",
    image_unreachable:
      "The photo could not be downloaded. Upload it from your device instead.",
    image_corrupt:
      "This photo could not be read. Take a new photo or upload a JPG or PNG.",
    image_format_unsupported: "Choose a JPG, PNG or WebP photo and try again.",
    image_invalid_base64:
      "The photo data is incomplete. Select the photo again.",
    payload_too_large:
      "This photo is too large. Crop it or choose a smaller image.",
    not_implemented:
      "January does not currently provide this operation. Try another way to add your meal.",
    end_user_id_required:
      "Your device identity is missing. Reload the app before trying again.",
    date_range_too_large: "Choose a date range of 60 days or fewer.",
    conflict:
      "This day changed since it was opened. Refresh your diary, review the latest meal, and save again.",
    transport_error:
      "The request could not be confirmed. Check your connection. For a meal being saved, refresh the diary before adding it again.",
    internal_error:
      "January could not finish this request. Wait a moment and try again.",
    upstream_error:
      "January could not reach its food service. Wait a moment and try again.",
    upstream_timeout:
      "January took too long to respond. Try again later. If you were saving a meal, refresh the diary first.",
    service_unavailable:
      "January is temporarily unavailable. Wait a moment and try again.",
  };
  return (
    actions[code] ??
    (status === 401 || status === 403
      ? actions.unauthorized!
      : status === 409 || status === 412
        ? actions.conflict!
        : "Something prevented this request. Check your connection and inputs, then try again.")
  );
}
