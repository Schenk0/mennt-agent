import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: [".next/**", "node_modules/**", "out/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...compat.extends("plugin:jsx-a11y/recommended"),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@next/next/no-head-element": "error",
      "@next/next/no-img-element": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/headers",
              message:
                "Static export does not support headers(), cookies(), or draftMode().",
            },
            {
              name: "next/server",
              message:
                "Static export has no runtime server support for NextRequest/NextResponse.",
            },
            {
              name: "next/cache",
              message:
                "Avoid runtime cache APIs in static-export projects.",
            },
          ],
        },
      ],
      "no-restricted-exports": [
        "error",
        {
          restrictedNamedExports: [
            "dynamic",
            "dynamicParams",
            "revalidate",
            "fetchCache",
            "runtime",
            "preferredRegion",
            "maxDuration",
          ],
        },
      ],
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/self-closing-comp": "warn",
    },
  },
];
