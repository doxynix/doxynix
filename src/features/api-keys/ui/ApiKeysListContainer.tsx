import { api } from "@/server/trpc/server";
import { ApiKeysList } from "./ApiKeysList";

export async function ApiKeysListContainer() {
  const data = await (await api()).apikey.list();

  return <ApiKeysList active={data.active} archived={data.archived} />;
}
