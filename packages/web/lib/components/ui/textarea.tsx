import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-[14px] border border-[rgba(217,230,245,0.9)] bg-white/95 px-3 py-2.5 text-[13px] leading-[1.5] text-[#2b2f36] outline-none transition-[border-color,box-shadow] duration-[160ms] ease focus:border-[rgba(145,196,238,0.8)] focus:shadow-[0_0_0_4px_rgba(145,196,238,0.2)]",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";

export { Textarea };
