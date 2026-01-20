import { Metadata } from "next";
import { SearchX } from "lucide-react";

import BackOrLinkButton from "@/shared/ui/BackOrLinkButton";

export const metadata: Metadata = {
  title: "404",
};

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="bg-warning/10 text-warning flex size-20 items-center justify-center rounded-full">
        <SearchX className="animate-pulse" size={35} />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">404 — Page Not Found</h1>
        <p className="text-muted-foreground text-lg">Sorry, this page does not exist.</p>
      </div>

      <div className="flex items-center gap-4">
        <BackOrLinkButton text="Back" />
        <BackOrLinkButton text="Home" href="/" />
      </div>
      <p className="text-muted-foreground text-sm">Check the URL or return to the homepage.</p>
    </div>
  );
}
