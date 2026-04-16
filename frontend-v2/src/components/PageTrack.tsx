import type { JSX, Component } from "solid-js";

type Props = {
  children: JSX.Element;
};

/**
 * Horizontal swipe scroller for touch-first navigation between pages.
 * Uses native CSS scroll-snap — no manual touch handling needed, works
 * perfectly on the HYTE panel with finger swipes.
 *
 * Each direct child renders as a full viewport "page".
 */
export const PageTrack: Component<Props> = (props) => (
  <div
    class="page-track"
    style={{
      display: "flex",
      "overflow-x": "auto",
      "overflow-y": "hidden",
      "scroll-snap-type": "x mandatory",
      width: "100vw",
      height: "100vh",
    }}
  >
    {props.children}
  </div>
);

type PageProps = {
  children: JSX.Element;
  id?: string;
};

export const Page: Component<PageProps> = (props) => (
  <section
    id={props.id}
    class="page"
    style={{
      flex: "0 0 100vw",
      height: "100vh",
      "overflow-y": "auto",
      "scroll-snap-align": "start",
      "scroll-snap-stop": "always",
    }}
  >
    {props.children}
  </section>
);
