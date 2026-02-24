import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "border border-[#d9e6f5] rounded-2xl bg-white/90 shadow-[0_10px_25px_rgba(21,33,54,0.06)] overflow-hidden",
      className,
    )}
    {...props}
  />
));

Card.displayName = "Card";

export { Card };
