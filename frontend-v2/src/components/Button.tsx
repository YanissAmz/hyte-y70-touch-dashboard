import type { JSX, Component } from "solid-js";

type Variant = "default" | "primary" | "danger";

type Props = {
  children: JSX.Element;
  onClick?: (e: MouseEvent) => void;
  variant?: Variant;
  size?: "default" | "lg";
  disabled?: boolean;
  class?: string;
  type?: "button" | "submit";
};

export const Button: Component<Props> = (props) => (
  <button
    type={props.type ?? "button"}
    disabled={props.disabled}
    onClick={(e) => props.onClick?.(e)}
    class={[
      "ui-btn",
      props.variant === "primary" ? "ui-btn-primary" : "",
      props.variant === "danger" ? "ui-btn-danger" : "",
      props.size === "lg" ? "ui-btn-lg" : "",
      props.disabled ? "opacity-50" : "",
      props.class ?? "",
    ].join(" ")}
  >
    {props.children}
  </button>
);
