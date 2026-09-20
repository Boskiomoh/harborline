import { getRequestConfig } from "next-intl/server";

// Harborline ships English only, but every UI string goes through next-intl.
// To add a language: resolve the locale here (for example from a cookie or the
// user's profile) and add messages/<locale>.json. No component changes needed.
export default getRequestConfig(async () => {
  const locale = "en";

  return {
    locale,
    // Absolute times are rendered in the viewer's own zone by <LocalTime>;
    // server-side formatting stays on a fixed zone so output is deterministic.
    timeZone: "UTC",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
