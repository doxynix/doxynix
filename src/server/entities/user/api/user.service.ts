import { TRPCError } from "@trpc/server";
import { UTApi } from "uploadthing/server";

import type { UpdateProfileInput } from "@/shared/api/schemas/user";

import type { DbClient, PrismaClientExtended } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";

const utapi = new UTApi();

export const userService = {
  async deleteAccount(db: DbClient, prisma: PrismaClientExtended, userId: number) {
    // NOTE: используется чистая призма
    const user = await prisma.user.findUnique({
      select: { imageKey: true },
      where: { id: userId },
    });

    if (user == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    await db.user.delete({
      where: { id: userId },
    });

    if (user.imageKey != null) {
      utapi.deleteFiles(user.imageKey).catch((error) => {
        logger.error({ error: error, msg: "Failed to delete avatar on account deletion" });
      });
    }

    return {
      message: "Your account and all associated data have been permanently deleted",
      success: true,
    };
  },

  async getMe(db: DbClient, userId: number) {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (user == null) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

    return {
      message: "User found",
      user: {
        createdAt: user.createdAt,
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.publicId,
        image: user.image,
        name: user.name,
        role: user.role,
        updatedAt: user.updatedAt,
      },
    };
  },

  async removeAvatar(db: DbClient, prisma: PrismaClientExtended, userId: number) {
    // NOTE: используется чистая призма
    const user = await prisma.user.findUnique({
      select: { imageKey: true },
      where: { id: userId },
    });

    const keyToDelete = user?.imageKey;

    await db.user.update({
      data: {
        image: null,
        imageKey: null,
      },
      where: { id: userId },
    });

    if (keyToDelete != null) {
      utapi.deleteFiles(keyToDelete).catch((error) => {
        logger.error({
          error: error instanceof Error ? error.message : String(error),
          keyToDelete,
          msg: "Failed to delete avatar from UT during removal",
          userId,
        });
      });
    }

    return { message: "Profile Picture removed", success: true };
  },

  async updateUser(db: DbClient, userId: number, input: UpdateProfileInput) {
    const updatedUser = await db.user.update({
      data: {
        // email: input.email,
        name: input.name,
      },
      where: { id: userId },
    });

    return {
      message: "Credentials updated",
      user: {
        ...updatedUser,
        id: updatedUser.publicId,
      },
    };
  },
};
