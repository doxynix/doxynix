import type { ComponentType } from "react";
import { getTranslations } from "next-intl/server";

import { AblyIcon } from "@/shared/ui/icons/ably-icon";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { NeonIcon } from "@/shared/ui/icons/neon-icon";
import { NextJSIcon } from "@/shared/ui/icons/nextjs-icon";
import { ResendIcon } from "@/shared/ui/icons/resend-icon";
import { TriggerIcon } from "@/shared/ui/icons/trigger-icon";
import { UploadThingIcon } from "@/shared/ui/icons/uploadthing-icon";
import { UpstashIcon } from "@/shared/ui/icons/upstash-icon";
import { VercelIcon } from "@/shared/ui/icons/vercel-icon";
import { Marquee } from "@/shared/ui/visuals/marquee";

type BrandLogo = { icon: ComponentType<{ className?: string }>; name: string };

const BRANDS = [
  { icon: VercelIcon, name: "Vercel" },
  { icon: NextJSIcon, name: "Next.js" },
  { icon: TriggerIcon, name: "Trigger.dev" },
  // { name: "OpenAI", icon: OpenAiLogo },
  { icon: ResendIcon, name: "Resend" },
  { icon: UpstashIcon, name: "Upstash" },
  { icon: AblyIcon, name: "Ably" },
  { icon: UploadThingIcon, name: "Uploadthing" },
  { icon: GitHubIcon, name: "GitHub" },
  { icon: NeonIcon, name: "Neon" },
] as const satisfies readonly BrandLogo[];

export async function BrandsSection() {
  const t = await getTranslations("Landing");

  return (
    <section
      id="brands"
      className="glass-panel bg-landing-bg-light/55 border-border/70 relative border-y py-12"
    >
      <div className="mx-auto">
        <p className="text-muted-foreground mb-8 text-center text-sm font-medium tracking-widest uppercase">
          {t("section_brands_title")}
        </p>
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden mask-[linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]">
          <Marquee pauseOnHover className="max-h-12 [--duration:20s] sm:max-h-36">
            {BRANDS.map((tech) => (
              <div
                key={tech.name}
                className="transition-standard text-muted-foreground hover:border-border/80 hover:bg-card/70 hover:text-foreground flex cursor-default items-center gap-2 rounded-2xl border border-transparent px-3 py-3 text-xl font-semibold grayscale hover:grayscale-0 sm:px-8"
              >
                <tech.icon />
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
