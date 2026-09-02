import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "volt" | "ghost" | "magenta";
}

const variants: Record<string, string> = {
  volt: "bg-volt text-void hover:bg-fog",
  magenta: "bg-magenta text-void hover:bg-fog",
  ghost: "bg-transparent text-fog border border-white/15 hover:border-fog"
};

export function Button({ variant = "volt", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 font-body text-sm
        transition-colors duration-150 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
