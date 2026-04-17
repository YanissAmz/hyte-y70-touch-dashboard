import { onMount, onCleanup, createEffect, type Component } from "solid-js";

type Props = {
  values: number[];
  max?: number;
  height?: number;
  fill?: boolean;
};

export const Sparkline: Component<Props> = (props) => {
  let wrap: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let cssW = 0;
  let cssH = 0;

  const resize = (): void => {
    if (!wrap || !canvas) return;
    const w = Math.floor(wrap.clientWidth);
    const h = props.height ?? 60;
    if (w === cssW && h === cssH) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr); }
    cssW = w;
    cssH = h;
  };

  const draw = (): void => {
    if (!canvas || cssW === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cssW, cssH);

    const values = props.values;
    if (values.length < 2) return;

    const max = props.max ?? Math.max(...values, 1);
    const range = Math.max(max, 1);
    const stepX = cssW / (values.length - 1);

    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue("--accent").trim() || "#7DAAFF";
    const glow   = root.getPropertyValue("--accent-glow").trim() || "rgba(125,170,255,0.18)";

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = i * stepX;
      const y = cssH - (v / range) * cssH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (props.fill ?? true) {
      ctx.lineTo(cssW, cssH);
      ctx.lineTo(0, cssH);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
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
  createEffect(() => { void props.values; draw(); });

  return (
    <div ref={wrap} style={{ width: "100%", height: `${props.height ?? 60}px` }}>
      <canvas ref={canvas} />
    </div>
  );
};
