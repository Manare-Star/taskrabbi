// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  globalIgnores([
    "dist/*",
    ".expo/*",
    "node_modules/*",
    // Deno code with its own globals and URL imports; typechecked separately.
    "supabase/functions/*",
  ]),
  expoConfig,
  {
    rules: {
      // Apostrophes and quotes in copy are fine as-is; JSX renders them correctly.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // Node scripts and the database tests, not app code.
    files: ["scripts/**", "tests/**", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
]);
