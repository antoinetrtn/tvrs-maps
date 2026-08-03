import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import jsxA11y from "eslint-plugin-jsx-a11y";
import security from "eslint-plugin-security";
import promise from "eslint-plugin-promise";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import prettierPlugin from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "supabase/**", "tests/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
      "jsx-a11y": jsxA11y,
      security,
      promise,
      "simple-import-sort": simpleImportSort,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: "19.0" },
    },
    rules: {
      // React
      ...react.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Unused imports/vars (stricter)
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // Import sorting
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Prettier integration (must be before eslint-config-prettier spread)
      "prettier/prettier": "error",

      // Accessibility
      ...jsxA11y.configs.recommended.rules,
      // Downgrade some strict interaction rules to warn for now (game UI with custom controls/glass panels);
      // full keyboard + ARIA can be improved iteratively without blocking other quality gains.
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-autofocus": "warn",

      // Security (selected rules to avoid too much noise)
      "security/detect-unsafe-regex": "warn",
      "security/detect-buffer-noassert": "error",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-eval-with-expression": "error",

      // Promise
      "promise/always-return": "warn",
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/catch-or-return": "warn",

      // Core strictness
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "warn",
      curly: ["error", "all"],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-throw-literal": "error",
      "array-callback-return": "error",
      "no-implicit-coercion": ["warn", { boolean: true, number: true, string: true }],
      "no-alert": "warn",

      // General
      "no-duplicate-imports": "error",
    },
  },
  {
    files: ["src/tests/**/*.{js,jsx}", "scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  // Turn off stylistic rules that conflict with Prettier (must be last)
  eslintConfigPrettier,
];
