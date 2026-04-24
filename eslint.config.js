import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["node_modules/**", "wasm/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2024,
                Bun: "readonly",
            },
        },
        rules: {
            "brace-style": ["error", "allman", { allowSingleLine: true }],
        },
    },
];
