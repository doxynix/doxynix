import { ComponentType } from "react";

import { AblyIcon } from "@/shared/ui/icons/ably-icon";
import GitHubIcon from "@/shared/ui/icons/github-icon";
import { NeonIcon } from "@/shared/ui/icons/neon-icon";
import { NextJSIcon } from "@/shared/ui/icons/next-js-icon";
import { OpenAiLogo } from "@/shared/ui/icons/open-ai-icon";
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
  { name: "OpenAI", icon: OpenAiLogo },
  { name: "Resend", icon: ResendIcon },
  { name: "Upstash", icon: UpstashIcon },
  { name: "Ably", icon: AblyIcon },
  { name: "Uploadthing", icon: UploadThingIcon },
  { name: "GitHub", icon: GitHubIcon },
  { name: "Neon", icon: NeonIcon },
];

export function BrandsSection() {
  return (
    <section
      id="brands"
      className="bg-landing-bg-light/20 relative z-10 border-y border-zinc-900 py-24 backdrop-blur-sm"
    >
      <div className="mx-auto">
        <p className="text-muted-foreground mb-8 text-center text-sm font-medium tracking-widest uppercase">
          Document projects built with
        </p>
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <Marquee pauseOnHover className="[--duration:20s]">
            {BRANDS.map((tech) => (
              <div
                key={tech.name}
                className="text-muted-foreground flex cursor-default items-center gap-2 px-8 text-xl font-semibold grayscale transition-all hover:grayscale-0"
              >
                <tech.icon className="rounded p-1 text-xs" />
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-zinc-900"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-zinc-900"></div>
        </div>
      </div>
    </section>
  );
}
