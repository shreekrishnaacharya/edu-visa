import react from "eslint-plugin-react";
import tsParser from "@typescript-eslint/parser";
export default [
  {
    files: ["src/**/*.{jsx,tsx}"],
    plugins: { react },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    rules: { "react/jsx-key": ["error", { checkFragmentShorthand: true, checkKeyMustBeforeSpread: true, warnOnDuplicates: true }] },
    settings: { react: { version: "detect" } },
  },
];
