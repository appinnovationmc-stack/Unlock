import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "volt" | "ghost" | "magenta";
}

const variants: Record<string, string> = {
  volt: "bg-volt text-void hover:bg-fog",
  magenta: "bg-magenta text-void hover:bg-fog",
  ghost: "bg-transparent text-fog border border-mute/40 hover:border-volt hover:text-volt"
};

export function Button({ variant = "volt", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 px-6 py-3 font-display text-sm uppercase tracking-wide
        clip-keyhole-sm transition-colors duration-150 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
