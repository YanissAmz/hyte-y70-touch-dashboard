import type { JSX, Component } from "solid-js";

type Props = {
  children: JSX.Element;
  columns?: number;
  gap?: number;
  class?: string;
};

export const TileGrid: Component<Props> = (props) => {
  const cols = () => props.columns ?? 2;
  const gap = () => props.gap ?? 16;
  return (
    <div
      class={props.class ?? ""}
      style={{
        display: "grid",
        "grid-template-columns": `repeat(${cols()}, minmax(0, 1fr))`,
        gap: `${gap()}px`,
      }}
    >
      {props.children}
    </div>
  );
};
