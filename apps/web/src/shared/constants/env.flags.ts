const NODE_ENV = process.env.NODE_ENV;
const CI = process.env.CI;

export const IS_DEV = NODE_ENV === "development";
export const IS_PROD = NODE_ENV === "production";
export const IS_TEST = NODE_ENV === "test";
export const IS_CI = CI === "true";
export const IS_ANALYZE = process.env.ANALYZE === "true";
