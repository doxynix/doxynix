import * as LabelPrimitives from "@radix-ui/react-label";
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import { cx } from "../../lib/utils";

interface LabelProps extends ComponentPropsWithoutRef<typeof LabelPrimitives.Root> {
  disabled?: boolean;
}

const Label = forwardRef<ComponentRef<typeof LabelPrimitives.Root>, LabelProps>(
  ({ className, disabled, ...props }, forwardedRef) => (
    <LabelPrimitives.Root
      ref={forwardedRef}
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
      aria-disabled={disabled}
      tremor-id="tremor-raw"
      {...props}
    />
  ),
);

Label.displayName = "Label";

export { Label };
