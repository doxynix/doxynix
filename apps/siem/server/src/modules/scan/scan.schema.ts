import { z } from "zod";

const MAX_LOG_SIZE_CHARS = 2 * 1024 * 1024;

export const scanRequestSchema = z.object({
  content: z
    .string()
    .min(1, "Log content cannot be empty")
    .max(MAX_LOG_SIZE_CHARS, "Log content exceeds maximum allowed size (2MB)"),
  fileName: z
    .string()
    .max(255, "File name must not exceed 255 characters")
    .optional()
    .default("manual_scan.log"),
});

export type ScanRequestInput = z.infer<typeof scanRequestSchema>;
