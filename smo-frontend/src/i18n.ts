import "moment/dist/locale/de";
import "moment/dist/locale/hu";
import "moment/dist/locale/tr";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import moment from "moment";
import { initReactI18next } from "react-i18next";

import resources from "./assets/translations.json";
import { captureEvent } from "@sentry/react";

export const SUPPORTED_LANGUAGES = ["en", "de", "hu", "tr"];

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
  captureEvent({
    message: "Missing translation key",
    extra: { lngs, namespace, key },
  });
});

console.log("i18n initialized with language:", i18n.language);
moment.locale(i18n.language);

export default i18n;
