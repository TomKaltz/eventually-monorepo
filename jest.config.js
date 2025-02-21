/* eslint-disable no-undef */
/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*spec.ts"],
  coveragePathIgnorePatterns: [
    "node_modules",
    "dist",
    "__tests__",
    "__mocks__"
  ],
  moduleNameMapper: {
    "^@rotorsoft/eventually(.*)$": "<rootDir>/libs/eventually$1/src"
  }
};
