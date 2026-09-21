import * as z from "zod/mini";

export const parseProgress = (val: unknown) =>
  z.catch(z.number().check(z.gte(0), z.lte(100)), 0).parse(val);

export const parseStatusMessage = (val: unknown, fallback: string) =>
  z.catch(z.string(), fallback).parse(val);

export const parseTaskLogs = (val: unknown) => z.catch(z.array(z.string()), []).parse(val);
