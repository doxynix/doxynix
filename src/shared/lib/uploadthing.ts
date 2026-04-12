import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/server/shared/infrastructure/core";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
