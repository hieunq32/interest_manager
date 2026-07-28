import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
};

export function Button({ children, icon, variant = "secondary", ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant}`} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
