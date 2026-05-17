export const OpenApiErrorResponses = {
  400: "Invalid request",
  401: "Authorization required",
  403: "Insufficient permissions",
  404: "Resource not found",
  409: "Resource conflict",
  422: "Data validation error",
  429: "Too many requests",
  500: "Internal server error",
  503: "Service temporarily unavailable",
} as const;
