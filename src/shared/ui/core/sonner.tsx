"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        classNames: {
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          description: "group-[.toast]:text-muted-foreground",
          toast:
            "group toast group-[.toaster]:glass-panel group-[.toaster]:bg-popover group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md",
        },
        style: {
          background: "var(--popover)",
          border: `1px solid var(--border)`,
          color: "var(--foreground)",
        },
      }}
      className="toaster group"
      style={{
        "--sonner-background": "var(--popover)",
        "--sonner-border": "var(--border)",
        "--sonner-text-primary": "var(--foreground)",
        "--sonner-text-secondary": "var(--text-secondary)",
      } as React.CSSProperties}
      {...props}
    />
  );
};

export { Toaster };
