function readCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return undefined;
  }

  const { data } = error as { data?: unknown };

  if (typeof data !== "object" || data === null || !("code" in data)) {
    return undefined;
  }

  const { code } = data as { code?: unknown };

  return typeof code === "string" ? code : undefined;
}

function readMessage(error: unknown): string {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const { message } = error as { message?: unknown };

  return typeof message === "string" ? message : "";
}

// Billing rejects with the machine codes the server already emits; the screen turns each one into
// a sentence instead of letting a raw tRPC error reach the boundary.
export function billingErrorKey(error: unknown): string {
  const code = readCode(error);
  const message = readMessage(error);

  if (code === "PAYMENT_REQUIRED" || message === "PAYMENT_REQUIRED") {
    return "billing_error_payment_required";
  }

  switch (message) {
    case "LIMIT_EXCEEDED": {
      return "billing_error_limit_exceeded";
    }
    case "SEATS_BELOW_MEMBERS": {
      return "billing_error_seats_below_members";
    }
    case "CONCURRENT_SEAT_CHANGE": {
      return "billing_error_concurrent_seat_change";
    }
    case "BILLING_NOT_CHANGEABLE": {
      return "billing_error_not_changeable";
    }
    case "ALREADY_SUBSCRIBED": {
      return "billing_error_already_subscribed";
    }
    case "BILLING_CUSTOMER_NOT_FOUND": {
      return "billing_error_customer_missing";
    }
    case "Owner rights required": {
      return "billing_error_owner_only";
    }
    default: {
      return "billing_error_generic";
    }
  }
}
