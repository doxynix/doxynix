import type { DBAdapter, Where } from "better-auth";

import { normalizeEmail } from "@/server/utils/email-guard";
import { getNormalizedHash, getRawHash } from "@/server/utils/hash";

import { prisma } from "../db";

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

function transformPayloadData(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  for (const key of Object.keys(result)) {
    const hashMapping = HASH_FIELD_MAP[key];
    if (hashMapping && typeof result[key] === "string") {
      result[hashMapping.hashField] = hashMapping.hashFn(result[key]);
    }
  }

  if (result.image === "") {
    result.image = null;
  }

  return result;
}

export function createAdapterInstance(client: any): DBAdapter {
  return {
    consumeOne: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      await delegate.delete({
        where: { id: record.id },
      });

      return record;
    },

    count: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);
      return await delegate.count({
        where: prismaWhere,
      });
    },

    create: async ({ data, model }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const patchedData = transformPayloadData(data);

      const created = await delegate.create({
        data: patchedData,
      });

      return created;
    },

    delete: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record != null) {
        await delegate.delete({
          where: { id: record.id },
        });
      }
    },

    deleteMany: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);

      const result = await delegate.deleteMany({
        where: prismaWhere,
      });

      return result.count;
    },

    findMany: async ({ limit, model, offset, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = where ? mapWhere(where) : undefined;

      const records = await delegate.findMany({
        where: prismaWhere,
        ...(limit !== undefined && { take: limit }),
        ...(offset !== undefined && { skip: offset }),
      });

      return records as any[];
    },

    findOne: async ({ model, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({
        where: prismaWhere,
      });

      return record;
    },

    id: "custom-prisma-adapter",

    incrementOne: async ({ increment, model, set, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      const prismaIncrement: Record<string, any> = {};
      for (const [key, val] of Object.entries(increment)) {
        prismaIncrement[key] = {
          increment: val,
        };
      }

      const prismaSet = set ? transformPayloadData(set) : {};

      const updated = await delegate.update({
        data: {
          ...prismaIncrement,
          ...prismaSet,
        },
        where: { id: record.id },
      });

      return updated;
    },

    transaction: async (callback) => {
      if (typeof client.$transaction === "function") {
        return await client.$transaction(async (tx: any) => {
          const txAdapter = createAdapterInstance(tx);
          return callback(txAdapter);
        });
      } else {
        const txAdapter = createAdapterInstance(client);
        return callback(txAdapter);
      }
    },

    update: async ({ model, update, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);
      const patchedUpdate = transformPayloadData(update as Record<string, unknown>);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      const updated = await delegate.update({
        data: patchedUpdate,
        where: { id: record.id },
      });

      return updated;
    },

    updateMany: async ({ model, update, where }) => {
      const delegate = client[model === "verification_tokens" ? "verification" : model];
      const prismaWhere = mapWhere(where);
      const patchedUpdate = transformPayloadData(update as Record<string, unknown>);

      const result = await delegate.updateMany({
        data: patchedUpdate,
        where: prismaWhere,
      });

      return result.count;
    },
  };
}

function mapWhere(conditions?: Where[]): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (conditions == null) {
    return query;
  }

  for (const cond of conditions) {
    let field = cond.field;

    let value = cond.value;

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
