import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-[rgba(217,230,245,0.95)] bg-white/85 px-3 py-[10px] text-[#2b2f36] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.55)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.18)]",
      className,
    )}
    {...props}
  />
));

Select.displayName = "Select";

export { Select };
