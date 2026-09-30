import type { DBAdapter, Where } from "better-auth";

import { normalizeEmail } from "@/server/core/email-guard";
import { getNormalizedHash, getRawHash } from "@/server/utils/hash";

import { type DbClient, prisma } from "../db";

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

// better-auth addresses rows by field name, so rows stay untyped here.
type AdapterRow = Record<string, unknown> & { id: string };

// better-auth names models as runtime strings, so the delegate's own generics are unrecoverable; the untyped hop is bounded to the eight methods this adapter calls.
type ModelDelegate = {
  count: (args: { where: unknown }) => Promise<number>;
  create: (args: { data: unknown }) => Promise<AdapterRow>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
  deleteMany: (args: { where: unknown }) => Promise<{ count: number }>;
  findFirst: (args: { where: unknown }) => Promise<AdapterRow | null>;
  findMany: (args: { skip?: number; take?: number; where: unknown }) => Promise<AdapterRow[]>;
  update: (args: { data: unknown; where: { id: string } }) => Promise<AdapterRow>;
  updateMany: (args: { data: unknown; where: unknown }) => Promise<{ count: number }>;
};

const delegateFor = (client: DbClient, model: string): ModelDelegate =>
  (client as unknown as Record<string, ModelDelegate>)[
    model === "verification_tokens" ? "verification" : model
  ] as ModelDelegate;

export function createAdapterInstance(client: DbClient): DBAdapter {
  return {
    consumeOne: async <T>({
      model,
      where,
    }: {
      model: string;
      where: Where[];
    }): Promise<T | null> => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      await delegate.delete({
        where: { id: record.id },
      });

      return record as T;
    },

    count: async ({ model, where }) => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);
      return delegate.count({
        where: prismaWhere,
      });
    },

    create: async <T extends Record<string, unknown>, R = T>({
      data,
      model,
    }: {
      data: Record<string, unknown>;
      model: string;
    }): Promise<R> => {
      const delegate = delegateFor(client, model);
      const patchedData = transformPayloadData(data);

      const created = await delegate.create({
        data: patchedData,
      });

      return created as R;
    },

    delete: async ({ model, where }) => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record != null) {
        await delegate.delete({
          where: { id: record.id },
        });
      }
    },

    deleteMany: async ({ model, where }) => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);

      const result = await delegate.deleteMany({
        where: prismaWhere,
      });

      return result.count;
    },

    findMany: async <T>({
      limit,
      model,
      offset,
      where,
    }: {
      limit?: number;
      model: string;
      offset?: number;
      where?: Where[];
    }): Promise<T[]> => {
      const delegate = delegateFor(client, model);
      const prismaWhere = where ? mapWhere(where) : undefined;

      const records = await delegate.findMany({
        where: prismaWhere,
        ...(limit !== undefined && { take: limit }),
        ...(offset !== undefined && { skip: offset }),
      });

      return records as T[];
    },

    findOne: async <T>({ model, where }: { model: string; where: Where[] }): Promise<T | null> => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({
        where: prismaWhere,
      });

      return record as T | null;
    },

    id: "custom-prisma-adapter",

    incrementOne: async <T>({
      increment,
      model,
      set,
      where,
    }: {
      increment: Record<string, number>;
      model: string;
      set?: Record<string, unknown>;
      where: Where[];
    }): Promise<T | null> => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      const prismaIncrement: Record<string, { increment: number }> = {};
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

      return updated as T;
    },

    transaction: async (callback) => {
      if ("$transaction" in client && typeof client.$transaction === "function") {
        return client.$transaction(async (tx: DbClient) => {
          const txAdapter = createAdapterInstance(tx);
          return callback(txAdapter);
        });
      } else {
        const txAdapter = createAdapterInstance(client);
        return callback(txAdapter);
      }
    },

    update: async <T>({
      model,
      update,
      where,
    }: {
      model: string;
      update: Record<string, unknown>;
      where: Where[];
    }): Promise<T | null> => {
      const delegate = delegateFor(client, model);
      const prismaWhere = mapWhere(where);
      const patchedUpdate = transformPayloadData(update);

      const record = await delegate.findFirst({ where: prismaWhere });
      if (record == null) {
        return null;
      }

      const updated = await delegate.update({
        data: patchedUpdate,
        where: { id: record.id },
      });

      return updated as T;
    },

    updateMany: async ({ model, update, where }) => {
      const delegate = delegateFor(client, model);
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
