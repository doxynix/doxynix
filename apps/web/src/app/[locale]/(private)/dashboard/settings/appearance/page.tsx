import { createMetadata } from "@/shared/lib/metadata";

import { AppearanceSettings } from "@/features/settings/ui/appearance/appearance-settings";

export const generateMetadata = createMetadata(
  "appearance_title",
  "appearance_desc",
  "/dashboard/settings/appearance",
);

export default function AppearancePage() {
  return <AppearanceSettings />;
}
