import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import * as LabelPrimitives from "@radix-ui/react-label";

import { cx } from "../../lib/utils";

interface LabelProps extends ComponentPropsWithoutRef<typeof LabelPrimitives.Root> {
  disabled?: boolean;
}

const Label = forwardRef<ComponentRef<typeof LabelPrimitives.Root>, LabelProps>(
  ({ className, disabled, ...props }, forwardedRef) => (
    <LabelPrimitives.Root
      aria-disabled={disabled}
      className={cx(
        // base
        "text-sm leading-none",
        // text color
        "text-gray-900 dark:text-gray-50",
        // disabled
        {
          "text-gray-400 dark:text-gray-600": disabled,
        },
        className,
      )}
      ref={forwardedRef}
      tremor-id="tremor-raw"
      {...props}
    />
  ),
);

Label.displayName = "Label";

export { Label };
