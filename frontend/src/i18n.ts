import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-xhr-backend";
import detector from "i18next-browser-languagedetector";
import { ILanguageFlags } from "./interfaces";
const namespaces = [
  "common",
  "dashboard",
  "academic",
  "vehicle",
  "student",
  "employee",
  "exam",
  "repo",
  "datavalue",
  "inventory",
  "library",
  "notice",
  "billing",
  "account",
  "auth",
  "app"
];
i18n
  .use(Backend)
  .use(detector)
  .use(initReactI18next)
  .init({
    supportedLngs: ["us", "np"],
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json", // Load specific namespaces
    },
    fallbackLng: "us",
    ns: namespaces, // Define namespaces
    defaultNS: "common", // Default namespace, can be set to any
    interpolation: {
      escapeValue: false, // React already does escaping
    },
  });


export const languageFlags: Record<string, ILanguageFlags> = {
  us: {
    code: "us",
    name: "English",
    flag: "🇺🇸",
  },
  np: {
    code: "np",
    name: "Nepali",
    flag: "🇳🇵",
  },
};
export default i18n;
