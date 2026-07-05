import type { DBAdapter, Where } from "better-auth";

import { normalizeEmail } from "../../utils/email-guard";
import { getNormalizedHash, getRawHash } from "../../utils/hash";
import { prisma } from "../db";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function tryCoerceToNumber(value: unknown): unknown {
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (isPlainObject(value)) {
    const obj = { ...value };
    for (const key of Object.keys(obj)) {
      if (key === "id" || key === "userId") {
        obj[key] = tryCoerceToNumber(obj[key]);
      }
    }
    return obj;
  }

  return value;
}

const HASH_FIELD_MAP: Record<string, { hashField: string; hashFn: (val: string) => string }> = {
  email: {
    hashField: "emailHash",
    hashFn: (val) => getNormalizedHash(normalizeEmail(val)),
  },
  identifier: {
    hashField: "identifierHash",
    hashFn: (val) => getNormalizedHash(normalizeEmail(val)),
  },
  token: {
    hashField: "tokenHash",
    hashFn: getRawHash,
  },
  value: {
    hashField: "valueHash",
    hashFn: getRawHash,
  },
};

function coerceOutputIds(data: unknown): unknown {
  if (data == null) return data;

  if (Array.isArray(data)) {
    return data.map((e) => coerceOutputIds(e));
  }

  if (isPlainObject(data)) {
    const result = { ...data };
    for (const key of Object.keys(result)) {
      if ((key === "id" || key === "userId") && typeof result[key] === "number") {
        result[key] = String(result[key]);
      }
    }
    return result;
  }

  return data;
}

function transformPayloadData(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  for (const key of Object.keys(result)) {
    if (key === "id" || key === "userId") {
      result[key] = tryCoerceToNumber(result[key]);
    }

    const hashMapping = HASH_FIELD_MAP[key];
    if (hashMapping && typeof result[key] === "string") {
      result[hashMapping.hashField] = hashMapping.hashFn(result[key] as string);
    }
  }

  return result;
}

export function createAdapterInstance(client: any): DBAdapter {
  return {
    consumeOne: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) return null;

      await delegate.delete({
        where: { id: record.id },
      });

      return coerceOutputIds(record) as any;
    },

    count: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);
      return await delegate.count({
        where: prismaWhere,
      });
    },

    create: async ({ data, model }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const patchedData = transformPayloadData(data as Record<string, unknown>);

      const created = await delegate.create({
        data: patchedData,
      });

      return coerceOutputIds(created) as any;
    },

    delete: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record != null) {
        await delegate.delete({
          where: { id: record.id },
        });
      }
    },

    deleteMany: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);

      const result = await delegate.deleteMany({
        where: prismaWhere,
      });

      return result.count;
    },

    findMany: async ({ limit, model, offset, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = where ? mapWhere(model, where) : undefined;

      const records = await delegate.findMany({
        where: prismaWhere,
        ...(limit !== undefined && { take: limit }),
        ...(offset !== undefined && { skip: offset }),
      });

      return coerceOutputIds(records) as any[];
    },

    findOne: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);

      const record = await delegate.findFirst({
        where: prismaWhere,
      });

      return coerceOutputIds(record) as any;
    },

    id: "custom-prisma-adapter",

    transaction: async (callback) => {
      if (typeof client.$transaction === "function") {
        return await client.$transaction(async (tx: any) => {
          const txAdapter = createAdapterInstance(tx);
          return await callback(txAdapter);
        });
      } else {
        const txAdapter = createAdapterInstance(client);
        return await callback(txAdapter);
      }
    },

    update: async ({ model, update, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);
      const patchedUpdate = transformPayloadData(update as Record<string, unknown>);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      const updated = await delegate.update({
        data: patchedUpdate,
        where: { id: record.id },
      });

      return coerceOutputIds(updated) as any;
    },

    updateMany: async ({ model, update, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(model, where);
      const patchedUpdate = transformPayloadData(update as Record<string, unknown>);

      const result = await delegate.updateMany({
        data: patchedUpdate,
        where: prismaWhere,
      });

      return result.count;
    },
  };
}

function mapWhere(model: string, conditions: Where[]): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  for (const cond of conditions) {
    let field = cond.field;

    let value = cond.value;
    if (field === "id" || field === "userId") {
      value = tryCoerceToNumber(value);
    }

    const hashMapping = HASH_FIELD_MAP[field];
    if (hashMapping && typeof value === "string") {
      field = hashMapping.hashField;
      value = hashMapping.hashFn(value);
    }

    if (!cond.operator || cond.operator === "eq") {
      query[field] = value;
    } else {
      query[field] = { [cond.operator]: value };
    }
  }

  return query;
}

export const customAuthAdapter = createAdapterInstance(prisma);
