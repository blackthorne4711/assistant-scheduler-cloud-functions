module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "require-jsdoc": 0,
    "no-multi-spaces": 0,
    "max-len": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
    "indent": 0,
    "comma-spacing": 0,
    "object-curly-spacing": 0,
    "key-spacing": 0,
    "brace-style": 0,
    "block-spacing": 0,
    "no-trailing-spaces": 0,
    "@typescript-eslint/no-inferrable-types": 0,
    "linebreak-style": 0,
  },

};
