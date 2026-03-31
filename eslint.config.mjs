import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore generated files
    "convex/_generated/**",
    "analyze-translations.js",
    // Ignore config files
    "*.config.js",
    "*.config.mjs",
    "*.config.ts",
    // Ignore scripts
    "scripts/**",
    "remove-console-logs.js",
    // Ignore tests
    "src/__tests__/**",
    // Ignore public
    "public/**",
  ]),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Strict: don't allow explicit any
      "@typescript-eslint/no-explicit-any": "off",

      // Warning for unsafe operations (can be fixed gradually)
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      // Catch unused variables
      "@typescript-eslint/no-unused-vars": "off",

      // Disallow console in production (only in src, allow in convex)
      "no-console": "off",

      // Allow anonymous default exports for Next.js pages
      "import/no-anonymous-default-export": "off",

      // React rules
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/use-memo": "off",
      "react/jsx-no-undef": "off",
      "react-hooks/refs": "off",

      // TypeScript rules
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    }
  }
]);

export default eslintConfig;
