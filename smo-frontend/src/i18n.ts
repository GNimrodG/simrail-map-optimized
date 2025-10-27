import resources from "./assets/translations.json";

export const SUPPORTED_LANGUAGES = Object.keys(resources);

import "moment/dist/locale/de";
import "moment/dist/locale/hu";
import "moment/dist/locale/tr";
import "moment/dist/locale/pl";

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
    },
  });

i18n.on("languageChanged", (lng) => {
  console.log("Language changed to", lng);
  moment.locale(lng);
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
