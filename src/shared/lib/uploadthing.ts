import { generateReactHelpers } from "@uploadthing/react";

// eslint-disable-next-line boundaries/element-types
import type { OurFileRouter } from "@/server/shared/infrastructure/core";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
