import { UiApiKey } from "@/entities/api-keys";
import { ApiKeyArchivedTable } from "./ApiKeyArchivedTable";
import { ApiKeyCard } from "./ApiKeyCard";
import { ApiKeysEmpty } from "./ApiKeysEmpty";

type Props = {
  active: UiApiKey[];
  archived: UiApiKey[];
};

export function ApiKeysList({ active, archived }: Props) {
  return (
    <div className="flex w-full flex-col gap-6">
      {active.length === 0 ? (
        <ApiKeysEmpty />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {active.map((key) => (
            <ApiKeyCard key={key.id} active={key} />
          ))}
        </div>
      )}
      {archived.length > 0 && <ApiKeyArchivedTable archived={archived} />}
    </div>
  );
}
