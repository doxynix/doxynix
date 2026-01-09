import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

type ErrorMapping = {
  uniqueConstraint?: Record<string, string>;
  defaultConflict?: string;
  notFound?: string;
  notNull?: string;
  [key: string]: string | Record<string, string> | undefined;
};

type PrismaErrorMeta = {
  code: TRPCError["code"];
  defaultMessage: string;
  mapKey?: keyof ErrorMapping;
};

const prismaErrorMap: Record<string, PrismaErrorMeta> = {
  P2000: {
    code: "BAD_REQUEST",
    defaultMessage: "Значение поля слишком длинное для базы данных",
    mapKey: "custom",
  },
  P2002: {
    code: "CONFLICT",
    defaultMessage: "Запись с такими данными уже существует",
    mapKey: "uniqueConstraint",
  },
  P2003: {
    code: "BAD_REQUEST",
    defaultMessage: "Связанная запись не найдена (неверный ID)",
    mapKey: "custom",
  },
  P2004: {
    code: "FORBIDDEN",
    defaultMessage: "Доступ к ресурсу запрещен политикой безопасности",
    mapKey: "custom",
  },
  P2006: {
    code: "CONFLICT",
    defaultMessage: "Данные были изменены другим пользователем",
    mapKey: "custom",
  },
  P2007: {
    code: "BAD_REQUEST",
    defaultMessage: "Обязательное поле не заполнено",
    mapKey: "notNull",
  },
  P2010: { code: "NOT_FOUND", defaultMessage: "Запись не найдена", mapKey: "notFound" },
  P2016: { code: "NOT_FOUND", defaultMessage: "Запись не найдена", mapKey: "notFound" },
  P2025: { code: "NOT_FOUND", defaultMessage: "Запись не найдена", mapKey: "notFound" },
  P2030: {
    code: "BAD_REQUEST",
    defaultMessage: "Ошибка проверки связанной записи",
    mapKey: "custom",
  },
  P2034: { code: "BAD_REQUEST", defaultMessage: "Ошибка ограничения данных", mapKey: "custom" },
};

export function handlePrismaError(error: unknown, map?: ErrorMapping): never {
  if (error instanceof TRPCError) throw error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = prismaErrorMap[error.code];

    if (meta !== undefined) {
      let message: string = meta.defaultMessage;

      if (meta.mapKey !== undefined) {
        const mapValue = map?.[meta.mapKey];

        if (meta.mapKey === "uniqueConstraint") {
          const targetRaw = error.meta?.target;
          const target: string[] = Array.isArray(targetRaw)
            ? (targetRaw as string[])
            : typeof targetRaw === "string"
              ? targetRaw.split("_")
              : [];

          const field = target.find(
            (f): f is string => f !== undefined && map?.uniqueConstraint?.[f] !== undefined
          );

          if (field !== undefined && map?.uniqueConstraint?.[field] !== undefined) {
            message = map.uniqueConstraint[field];
          } else if (map?.defaultConflict !== undefined) {
            message = map.defaultConflict;
          }
        } else if (typeof mapValue === "string" && mapValue.length > 0) {
          message = mapValue;
        }
      }

      throw new TRPCError({ code: meta.code, message });
    }

    console.error("Unknown Prisma Error:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Произошла внутренняя ошибка базы данных",
    });
  }

  console.error("Unknown Error:", error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Произошла внутренняя ошибка сервера",
  });
}
