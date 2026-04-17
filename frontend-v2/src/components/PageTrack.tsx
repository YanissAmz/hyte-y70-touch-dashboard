import {
  createContext,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
  type Component,
} from "solid-js";
import { pageIndex, setPageIndex, setPageCount } from "~/stores/nav";

type Props = {
  children: JSX.Element;
};

/**
 * Horizontal swipe scroller — custom touch handler with a low threshold for
 * reliable navigation on touch panels. CSS scroll-snap was too soft: on a
 * 1100px portrait viewport it required dragging 550px+ before snapping.
 *
 * - Gesture axis locked on first touchmove (|dx| vs |dy| ratio)
 * - Horizontal: translateX tracks the finger in real time, commits or snaps
 *   back on release based on 80px threshold OR flick velocity (> 0.5 px/ms)
 * - Vertical: passes through untouched so pages scroll normally
 *
 * Each direct child renders as a full-viewport "page".
 */

const SWIPE_THRESHOLD_PX  = 80;
const FLICK_VELOCITY      = 0.5;     // px/ms
const AXIS_LOCK_RATIO     = 1.15;    // |dx| > |dy| * ratio → horizontal

export const PageTrack: Component<Props> = (props) => {
  let trackEl: HTMLDivElement | undefined;
  let wrapEl:  HTMLDivElement | undefined;

  const [dragDelta, setDragDelta] = createSignal(0);    // live offset while dragging
  const [dragging, setDragging] = createSignal(false);

  let startX = 0, startY = 0, startTs = 0;
  let axis: "h" | "v" | null = null;
  let pageCountLocal = 0;

  const update = (): void => {
    pageCountLocal = trackEl?.children.length ?? 0;
    setPageCount(pageCountLocal);
  };

  const goTo = (i: number): void => {
    if (!trackEl || pageCountLocal === 0) return;
    // Wrap around so swipes never hit a dead end
    const wrapped = ((i % pageCountLocal) + pageCountLocal) % pageCountLocal;
    setPageIndex(wrapped);
    setDragDelta(0);
  };

  const beginDrag = (x: number, y: number): void => {
    startX = x; startY = y;
    startTs = performance.now();
    axis = null;
    setDragging(true);
  };

  const updateDrag = (x: number, y: number, preventDefault: () => void): void => {
    if (!dragging()) return;
    const dx = x - startX;
    const dy = y - startY;
    if (axis === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axis = Math.abs(dx) > Math.abs(dy) * AXIS_LOCK_RATIO ? "h" : "v";
      } else return;
    }
    if (axis === "h") {
      preventDefault();
      setDragDelta(dx);
    }
  };

  const endDrag = (): void => {
    if (!dragging()) return;
    const dx = dragDelta();
    const dt = performance.now() - startTs;
    const velocity = Math.abs(dx) / Math.max(dt, 1);
    if (axis === "h") {
      const passThreshold = Math.abs(dx) > SWIPE_THRESHOLD_PX;
      const flicked = velocity > FLICK_VELOCITY && Math.abs(dx) > 20;
      if ((passThreshold || flicked) && dx < 0) goTo(pageIndex() + 1);
      else if ((passThreshold || flicked) && dx > 0) goTo(pageIndex() - 1);
      else setDragDelta(0);
    } else {
      setDragDelta(0);
    }
    setDragging(false);
    axis = null;
  };

  const onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    beginDrag(t.clientX, t.clientY);
  };
  const onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    updateDrag(t.clientX, t.clientY, () => e.preventDefault());
  };
  const onTouchEnd = (): void => endDrag();

  const onPointerDown = (e: PointerEvent): void => {
    // Ignore touch pointers — handled by touch listeners. Mouse + pen only.
    if (e.pointerType === "touch") return;
    beginDrag(e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "touch") return;
    updateDrag(e.clientX, e.clientY, () => e.preventDefault());
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === "touch") return;
    endDrag();
  };

  onMount(() => {
    update();
    const ro = new ResizeObserver(update);
    if (trackEl) ro.observe(trackEl);
    onCleanup(() => ro.disconnect());

    if (!wrapEl) return;
    wrapEl.addEventListener("touchstart", onTouchStart, { passive: true });
    wrapEl.addEventListener("touchmove",  onTouchMove,  { passive: false });
    wrapEl.addEventListener("touchend",   onTouchEnd,   { passive: true });
    wrapEl.addEventListener("touchcancel", onTouchEnd,  { passive: true });
    wrapEl.addEventListener("pointerdown", onPointerDown);
    wrapEl.addEventListener("pointermove", onPointerMove);
    wrapEl.addEventListener("pointerup",   onPointerUp);
    wrapEl.addEventListener("pointercancel", onPointerUp);
    onCleanup(() => {
      wrapEl?.removeEventListener("touchstart", onTouchStart);
      wrapEl?.removeEventListener("touchmove",  onTouchMove);
      wrapEl?.removeEventListener("touchend",   onTouchEnd);
      wrapEl?.removeEventListener("touchcancel", onTouchEnd);
      wrapEl?.removeEventListener("pointerdown", onPointerDown);
      wrapEl?.removeEventListener("pointermove", onPointerMove);
      wrapEl?.removeEventListener("pointerup",   onPointerUp);
      wrapEl?.removeEventListener("pointercancel", onPointerUp);
    });
  });

  const transformStyle = (): string => {
    const w = window.innerWidth;
    const base = -pageIndex() * w;
    const offset = dragging() ? dragDelta() : 0;
    return `translateX(${base + offset}px)`;
  };

  const transitionStyle = (): string =>
    dragging() ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      ref={wrapEl}
      class="page-track-wrap"
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        ref={trackEl}
        class="page-track"
        style={{
          display: "flex",
          "flex-direction": "row",
          width: "100%",
          height: "100%",
          transform: transformStyle(),
          transition: transitionStyle(),
          "will-change": "transform",
        }}
      >
        {props.children}
      </div>
    </div>
  );
};

type PageActivity = {
  active: Accessor<boolean>;
  mounted: Accessor<boolean>;
};

const PageActivityContext = createContext<PageActivity>();

export function usePageActivity(): PageActivity {
  return useContext(PageActivityContext) ?? {
    active: () => true,
    mounted: () => true,
  };
}

type PageProps = {
  children: JSX.Element;
  id?: string;
  index: number;
};

export const Page: Component<PageProps> = (props) => {
  const active = createMemo(() => pageIndex() === props.index);
  const mounted = createMemo(() => active());

  return (
    <section
      id={props.id}
      class="page"
      style={{
        flex: "0 0 100vw",
        height: "100vh",
        "overflow-y": active() ? "auto" : "hidden",
        "overflow-x": "hidden",
      }}
    >
      {mounted() ? (
        <PageActivityContext.Provider value={{ active, mounted }}>
          {props.children}
        </PageActivityContext.Provider>
      ) : null}
    </section>
  );
};
