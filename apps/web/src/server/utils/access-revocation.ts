import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import type { DbClient } from "@/server/core/db";
import { getNormalizedHash } from "@/server/utils/hash";

export async function revokeUserSessions(db: DbClient, userId: string): Promise<void> {
  try {
    const authContext = await auth.$context;

    await authContext.internalAdapter.deleteUserSessions(userId);
  } catch (error) {
    appLogger.error({ error, msg: "Session secondary storage could not be cleared", userId });
  }

  await db.session.deleteMany({ where: { userId } });
}

export async function revokeAccessForEmail(db: DbClient, email: string): Promise<number> {
  const emailHash = getNormalizedHash(email);

  const user = await db.user.findUnique({ select: { id: true }, where: { emailHash } });

  if (user == null) {
    return 0;
  }

  await revokeUserSessions(db, user.id);
  await db.apiKey.updateMany({ data: { revoked: true }, where: { userId: user.id } });

  return 1;
}
