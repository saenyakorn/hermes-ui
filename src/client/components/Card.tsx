import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function Card({ children, ...props }: CardProps) {
  return <div {...props}>{children}</div>;
}
