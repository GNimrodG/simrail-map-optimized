import resources from "./assets/translations.json";

export const SUPPORTED_LANGUAGES = Object.keys(resources);

import "moment/dist/locale/de";
import "moment/dist/locale/hu";
import "moment/dist/locale/tr";
import "moment/dist/locale/pl";
import "moment/dist/locale/ru";
import "moment/dist/locale/uk";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import moment from "moment";
import { initReactI18next } from "react-i18next";

import { isSentryLoaded$ } from "./utils/data-manager";

// check if all the language have their moment locale imported
for (const lng of SUPPORTED_LANGUAGES) {
  if (!moment.locales().includes(lng)) {
    console.warn("Moment locale is missing for", lng);
    if (isSentryLoaded$.getValue()) {
      import("@sentry/react")
        .then((Sentry) => {
          Sentry.captureEvent({
            message: "Moment locale is missing",
            extra: { lng },
          });
        })
        .catch((error) => {
          console.error("Failed to capture event in Sentry", error);
        });
    }
  }
}

// Only a language the user picked in the settings is remembered (see setLanguage), otherwise the browser language
// is used on every visit. The detector used to cache whatever it resolved, including the "en" fallback, so users
// who first visited before their language was translated stayed on English (and used browser translation instead).
const LANGUAGE_STORAGE_KEY = "language";
const LEGACY_LANGUAGE_STORAGE_KEY = "i18nextLng";

try {
  const legacy = localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
  if (legacy !== null) {
    // a stored non-English language was chosen or matched the browser, keep it; "en" may just be the old fallback
    if (legacy && !legacy.startsWith("en") && localStorage.getItem(LANGUAGE_STORAGE_KEY) === null) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, legacy);
    }
    localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
  }
} catch {
  // storage unavailable, the browser language is used
}

/**
 * Switches the language and remembers it as the user's choice.
 */
export function setLanguage(lng: string) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // storage unavailable, the choice lasts until reload
  }

  return i18n.changeLanguage(lng);
}

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",

    supportedLngs: SUPPORTED_LANGUAGES,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },

    detection: {
      order: ["querystring", "localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: [],
    },
  })
  // resources are bundled, so init finishes synchronously; this only rejects on a setup error
  .catch((error) => console.error("Failed to initialize i18n", error));

// Keep <html lang> in sync, otherwise browsers treat the page as English and offer (or auto-run) translation
// even when it's already shown in the user's language.
document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;

i18n.on("languageChanged", (lng) => {
  console.log("Language changed to", lng);
  moment.locale(lng);
  document.documentElement.lang = i18n.resolvedLanguage ?? lng;
});

i18n.on("missingKey", (lngs, namespace, key) => {
  console.warn("Missing translation key", lngs, namespace, key);

  if (isSentryLoaded$.getValue()) {
    import("@sentry/react")
      .then((Sentry) => {
        Sentry.captureEvent({
          message: "Missing translation key",
          extra: { lngs, namespace, key },
        });
      })
      .catch((error) => {
        console.error("Failed to capture event in Sentry", error);
      });
  }
});

console.log("i18n initialized with language:", i18n.language);
moment.locale(i18n.language);

export default i18n;
