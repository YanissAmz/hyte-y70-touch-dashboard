import type { JSX, Component } from "solid-js";

type Props = {
  children: JSX.Element;
  class?: string;
  size?: "default" | "lg";
};

export const Card: Component<Props> = (props) => (
  <div
    class={[
      "ui-card",
      props.size === "lg" ? "ui-card-lg" : "",
      props.class ?? "",
    ].join(" ")}
  >
    {props.children}
  </div>
);
