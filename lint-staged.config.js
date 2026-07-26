/** @type {import("lint-staged").Configuration} */
export default {
  "*.{js,mjs,cjs,ts}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{json,md,yaml,yml}": "prettier --write",
};
