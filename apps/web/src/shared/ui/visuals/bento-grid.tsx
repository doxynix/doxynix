import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";

import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  background: ReactNode;
  className: string;
  cta: string;
  description: string;
  href: string;
  Icon: ElementType;
  name: string;
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div className={cn("grid w-full auto-rows-88 grid-cols-3 gap-4", className)} {...props}>
      {children}
    </div>
  );
};

const BentoCard = ({
  background,
  className,
  cta,
  description,
  href,
  Icon,
  name,
  ...props
}: BentoCardProps) => (
  <div
    className={cn(
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl",
      // light styles
      "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      // dark styles
      "transform-gpu dark:bg-background dark:[border:1px_solid_var(--border)] dark:[box-shadow:0_-20px_80px_-20px_color-mix(in_oklab,var(--foreground)_14%,transparent)_inset]",
      className,
    )}
    key={name}
    {...props}
  >
    <div>{background}</div>
    <div className="p-4">
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-standard lg:group-hover:-translate-y-10">
        <Icon className="size-12 origin-left transform-gpu transition-standard ease-in-out group-hover:scale-75" />
        <h3 className="font-semibold text-xl">{name}</h3>
        <p className="max-w-lg text-muted-foreground">{description}</p>
      </div>

      <div
        className={cn(
          "pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center transition-standard group-hover:translate-y-0 group-hover:opacity-100 lg:hidden",
        )}
      >
        <AppButton asChild className="pointer-events-auto p-0" size="sm" variant="link">
          <Link href={href}>
            <span className="text-foreground">{cta}</span>
            <ArrowRightIcon className="ms-2 text-foreground rtl:rotate-180" />
          </Link>
        </AppButton>
      </div>
    </div>

    <div
      className={cn(
        "pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-standard group-hover:translate-y-0 group-hover:opacity-100 lg:flex",
      )}
    >
      <AppButton asChild className="pointer-events-auto p-0" size="sm" variant="link">
        <Link href={href}>
          <span className="text-foreground">{cta}</span>
          <ArrowRightIcon className="ms-2 text-foreground rtl:rotate-180" />
        </Link>
      </AppButton>
    </div>

    <div className="pointer-events-none absolute inset-0 transform-gpu transition-standard group-hover:bg-foreground/3" />
  </div>
);

export { BentoCard, BentoGrid };
