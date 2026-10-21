import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

// typescript-eslint needs the TypeScript 6 API: "typescript" in package.json is @typescript/typescript6, the build's
// tsc is TypeScript 7 ("typescript-7")
export default [
  // only the TypeScript sources are linted (the scripts are plain Node.js)
  { ignores: ["dist", "dev-dist", "**/*.{js,cjs,mjs}"] },
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  reactHooks.configs.flat.recommended,
  prettierRecommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
      "quote-props": ["warn", "consistent-as-needed"],
      "react-compiler/react-compiler": "warn",
      // leaving a property out of a rest spread ("{ ownerState: _ownerState, ...props }") is not an unused variable
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
];
