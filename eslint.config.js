export default [
  {
    ignores: ["node_modules/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        window: "readonly",
        KeyboardEvent: "readonly",
        HTMLElement: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "eqeqeq": "error",
      "no-constant-condition": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-shadow": "error",
      "no-trailing-spaces": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
