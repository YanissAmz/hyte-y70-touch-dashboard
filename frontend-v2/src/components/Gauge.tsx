import { onMount, onCleanup, createEffect, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";

type Props = {
  value: number;       // 0–100
  label?: string;
  unit?: string;
  size?: number;       // max CSS side; auto-shrinks to parent width
  thickness?: number;
};

export const Gauge: Component<Props> = (props) => {
  let wrap: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let cssSide = 0;

  const resize = (): void => {
    if (!wrap || !canvas) return;
    const parentW = Math.floor(wrap.clientWidth) || 200;
    const side = Math.min(props.size ?? 400, parentW);
    if (side === cssSide) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = side * dpr;
    canvas.height = side * dpr;
    canvas.style.width  = `${side}px`;
    canvas.style.height = `${side}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
    cssSide = side;
  };

  const draw = (): void => {
    if (!canvas || cssSide === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = cssSide;
    const t = props.thickness ?? Math.max(10, Math.round(s * 0.07));
    const cx = s / 2, cy = s / 2;
    const radius = (s - t) / 2;
    const start = -Math.PI * 1.25;
    const end   = Math.PI * 0.25;
    const pct = Math.max(0, Math.min(1, props.value / 100));
    const sweepEnd = start + (end - start) * pct;

    const root = getComputedStyle(document.documentElement);
    const ambi = wsSignals.ambilight.value();
    // Arc colour follows live ambilight; text stays neutral so numbers
    // remain readable regardless of TV content.
    const accent = ambi
      ? `rgb(${ambi.r}, ${ambi.g}, ${ambi.b})`
      : root.getPropertyValue("--accent").trim() || "#7DAAFF";
    const dim    = root.getPropertyValue("--text-dim").trim() || "#5B6370";
    const text   = root.getPropertyValue("--text").trim() || "#E6EDF3";
    const muted  = root.getPropertyValue("--text-muted").trim() || "#8B949E";

    ctx.clearRect(0, 0, s, s);

    ctx.lineCap = "round";
    ctx.lineWidth = t;
    ctx.strokeStyle = dim;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, sweepEnd);
    ctx.stroke();

    ctx.fillStyle = text;
    ctx.font = `700 ${s * 0.22}px "Space Grotesk", Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(props.value)}${props.unit ?? ""}`, cx, cy);

    if (props.label) {
      ctx.fillStyle = muted;
      ctx.font = `500 ${s * 0.08}px Inter, sans-serif`;
      ctx.fillText(props.label.toUpperCase(), cx, cy + s * 0.18);
    }
  };

  let ro: ResizeObserver | undefined;
  onMount(() => {
    resize();
    draw();
    ro = new ResizeObserver(() => { resize(); draw(); });
    if (wrap) ro.observe(wrap);
  });
  onCleanup(() => ro?.disconnect());
  createEffect(() => {
    void props.value;
    void wsSignals.ambilight.value();
    draw();
  });

  return (
    <div ref={wrap} style={{ width: "100%", display: "flex", "justify-content": "center" }}>
      <canvas ref={canvas} />
    </div>
  );
};
