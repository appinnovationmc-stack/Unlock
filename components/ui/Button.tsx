import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "volt" | "ghost" | "magenta";
}

const variants: Record<string, string> = {
  volt: "bg-volt text-white hover:bg-fog",
  magenta: "bg-magenta text-white hover:bg-fog",
  ghost: "bg-transparent text-fog border border-black/15 hover:border-fog"
};

export function Button({ variant = "volt", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-6 min-h-11 rounded-full font-body text-sm
        motion-safe:transition-colors motion-safe:duration-150
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fog
        ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
