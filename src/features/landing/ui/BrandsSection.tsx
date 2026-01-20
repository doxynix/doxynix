import { AblyIcon } from "@/shared/ui/AblyIcon";
import GitHubIcon from "@/shared/ui/github-icon";
import { Marquee } from "@/shared/ui/marquee";
import { NeonIcon } from "@/shared/ui/NeonIcon";
import { NextJSIcon } from "@/shared/ui/NextJSIcon";
import { OpenAiLogo } from "@/shared/ui/OpenAIIcon";
import { ResendIcon } from "@/shared/ui/ResendIcon";
import { TriggerIcon } from "@/shared/ui/TriggerIcon";
import { UploadThingIcon } from "@/shared/ui/uploadThingIcon";
import { UpstashIcon } from "@/shared/ui/UpstashIcon";
import { VercelIcon } from "@/shared/ui/VercelIcon";

export function BrandsSection() {
  const BRANDS = [
    { name: "Vercel", icon: <VercelIcon /> },
    { name: "Next.js", icon: <NextJSIcon /> },
    { name: "Trigger.dev", icon: <TriggerIcon /> },
    { name: "OpenAI", icon: <OpenAiLogo /> },
    { name: "Resend", icon: <ResendIcon /> },
    { name: "Upstash", icon: <UpstashIcon /> },
    { name: "Ably", icon: <AblyIcon /> },
    { name: "Uploadthing", icon: <UploadThingIcon /> },
    { name: "GitHub", icon: <GitHubIcon /> },
    { name: "Neon", icon: <NeonIcon /> },
  ];

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
                <span className="rounded p-1 text-xs">{tech.icon}</span>
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
