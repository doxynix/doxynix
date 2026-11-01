export type NonRetryableBillingCode =
  | "CUSTOMER_MAPPING_MISSING"
  | "EVENT_NOT_FOUND"
  | "OWNER_MISMATCH"
  | "SCHEMA_MISMATCH"
  | "SUBSCRIPTION_ITEM_MISSING"
  | "UNKNOWN_API_VERSION"
  | "UNSUPPORTED_EVENT_TYPE";

// Retrying cannot fix these: the payload, the ownership or the API version will not change.
export class NonRetryableBillingError extends Error {
  readonly code: NonRetryableBillingCode;

  constructor(code: NonRetryableBillingCode, message: string) {
    super(message);
    this.code = code;
    this.name = "NonRetryableBillingError";
  }
}
