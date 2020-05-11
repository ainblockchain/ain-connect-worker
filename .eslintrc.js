module.exports = {
  "env": {
    "es6": true,
    "node": true
  },
  "extends": [
    "airbnb-base",
    "plugin:@typescript-eslint/eslint-recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint"
  ],
  "rules": {
    "no-throw-literal": 0,
    "camelcase": 0,
    "no-restricted-syntax": 0,
    "import/no-extraneous-dependencies": 0,
    "no-await-in-loop": 0,
    "no-unused-vars": 0,
    "import/no-unresolved": 0,
    "class-methods-use-this": 0,
    "import/extensions": [0, "ignorePackages"],
  }
};
