"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

import { Spinner } from "./spinner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      icons={{
        error: <XCircle className="text-destructive size-3" />,
        info: <Info className="text-info size-3" />,
        loading: <Spinner />,
        success: <CheckCircle2 className="text-success size-3" />,
        warning: <AlertTriangle className="text-warning size-3" />,
      }}
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        classNames: {
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          description: "group-[.toast]:text-muted-foreground",
          toast: "group toast group-[.toaster]:glass-panel group-[.toaster]:border-border",
        },
        style: {
          background: "var(--popover)",
          border: `1px solid var(--border)`,
          color: "var(--foreground)",
        },
      }}
      className="toaster group"
      {...props}
    />
  );
};

export { Toaster };
