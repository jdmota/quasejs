//@ts-check

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.?([mc])[jt]s?(x)",
    "**/?(*.)+(spec|test).?([mc])[jt]s?(x)",
    "!**/__fixtures__/**",
    "!**/__examples__/**",
  ],
  extensionsToTreatAsEsm: [".ts"],
  roots: [
    "<rootDir>/packages/apps/debt-splitter",
    "<rootDir>/packages/ban-sensitive",
    "<rootDir>/packages/config",
    "<rootDir>/packages/error",
    "<rootDir>/packages/git",
    "<rootDir>/packages/schema",
    "<rootDir>/packages/source-map",
    "<rootDir>/packages/util",
  ],
  snapshotSerializers: ["./scripts/custom-serializer.cjs"],
};

export default config;
