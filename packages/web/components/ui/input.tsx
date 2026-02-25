import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-white/85 px-3 py-[10px] text-[#2b2f36] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
