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

type Props = { name: string; icon: ComponentType<{ className?: string }> };

const BRANDS: Props[] = [
  { name: "Vercel", icon: VercelIcon },
  { name: "Next.js", icon: NextJSIcon },
  { name: "Trigger.dev", icon: TriggerIcon },
  // { name: "OpenAI", icon: OpenAiLogo },
  { name: "Resend", icon: ResendIcon },
  { name: "Upstash", icon: UpstashIcon },
  { name: "Ably", icon: AblyIcon },
  { name: "Uploadthing", icon: UploadThingIcon },
  { name: "GitHub", icon: GitHubIcon },
  { name: "Neon", icon: NeonIcon },
];

export async function BrandsSection() {
  const t = await getTranslations("Landing");

  return (
    <section
      id="brands"
      className="bg-landing-bg-light/20 relative border-y border-zinc-900 py-12 backdrop-blur-sm"
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
                className="text-muted-foreground flex cursor-default items-center gap-2 px-2 text-xl font-semibold grayscale transition-all hover:grayscale-0 sm:px-8"
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
