import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border text-sm text-[#2b2f36] transition duration-150 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "border-[#d9e6f5] bg-white hover:-translate-y-[1px] hover:shadow-[0_14px_30px_rgba(21,33,54,0.1)]",
        secondary:
          "border-[rgba(175,122,197,0.5)] bg-[rgba(175,122,197,0.38)] hover:-translate-y-[1px] hover:shadow-[0_16px_32px_rgba(175,122,197,0.2)]",
        outline: "border-[rgba(217,230,245,0.9)] bg-white",
        soft: "border-[rgba(217,230,245,0.9)] bg-[rgba(247,251,255,0.92)] text-[#6b7480]",
      },
      size: {
        default: "px-3 py-2 text-sm",
        sm: "px-3 py-1.5 text-xs rounded-lg",
        icon: "h-10 w-10 p-0 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
