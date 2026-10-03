import { AppError } from "@/server/core/api-error";
import { prisma } from "@/server/core/db";

export async function markWebhookDeliveryFailed(deliveryId: string, error: unknown): Promise<void> {
  await prisma.webhookDelivery.update({
    data: {
      error: error instanceof Error ? error.message : String(error),
      status: "FAILED",
    },
    where: { id: deliveryId },
  });
}

export function toInternalAppError(error: unknown): AppError {
  return new AppError({
    cause: error,
    code: "INTERNAL_SERVER_ERROR",
    publicMessage: "Internal Error",
    unexpected: true,
  });
}
