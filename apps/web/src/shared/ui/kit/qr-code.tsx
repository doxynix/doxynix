import { QRCodeSVG } from "qrcode.react";

import { cn } from "@/shared/lib/cn";

type Props = {
  className?: string;
  size?: number;
  title?: string;
  value: string;
};

// The quiet zone is encoded as four modules, so a denser payload shows a thinner white frame and
// smaller modules at the same `size`. Both screens must stay on the same size/margin pair.
export function QrCode({ className, size = 180, title, value }: Readonly<Props>) {
  return (
    <div className={cn("rounded-xl bg-white p-2", className)}>
      <QRCodeSVG
        level="M"
        marginSize={4}
        size={size}
        title={title}
        value={value}
      />
    </div>
  );
}
