import { notFound } from "next/navigation";

import { createNotFoundMetadata } from "@/shared/lib/metadata";

export const generateMetadata = createNotFoundMetadata();

export default function CatchAllPage() {
  notFound();
}
