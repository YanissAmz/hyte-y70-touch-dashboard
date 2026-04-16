import { Show, type JSX, type Component } from "solid-js";

type Props = {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  title?: string;
};

export const Modal: Component<Props> = (props) => (
  <Show when={props.open}>
    <div
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: "0",
        "background-color": "rgba(0, 0, 0, 0.6)",
        "z-index": "100",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        class="ui-card ui-card-lg"
        style={{ "max-width": "90%", "min-width": "320px" }}
      >
        {props.title && (
          <h2 class="ui-title text-xl mb-4">{props.title}</h2>
        )}
        {props.children}
      </div>
    </div>
  </Show>
);
