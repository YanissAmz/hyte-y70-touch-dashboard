import { onMount, createEffect, type Component } from "solid-js";

type Props = {
  value: number;       // 0–100
  label?: string;
  unit?: string;
  size?: number;       // canvas side in CSS px
  thickness?: number;  // arc thickness
};

/**
 * Canvas arc gauge. Reads --accent from CSS to match the active theme.
 * The canvas is small (120-220px) so perf is fine on iGPU.
 */
export const Gauge: Component<Props> = (props) => {
  let canvas: HTMLCanvasElement | undefined;
  const size = () => props.size ?? 180;
  const thickness = () => props.thickness ?? 14;

  const draw = (): void => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const s = size();
    canvas.width = s * dpr;
    canvas.height = s * dpr;
    canvas.style.width = `${s}px`;
    canvas.style.height = `${s}px`;
    ctx.scale(dpr, dpr);

    const cx = s / 2, cy = s / 2;
    const radius = (s - thickness()) / 2;
    const start = -Math.PI * 1.25;
    const end   = Math.PI * 0.25;
    const pct = Math.max(0, Math.min(1, props.value / 100));
    const sweepEnd = start + (end - start) * pct;

    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue("--accent").trim() || "#7DAAFF";
    const dim    = root.getPropertyValue("--text-dim").trim() || "#5B6370";
    const text   = root.getPropertyValue("--text").trim() || "#E6EDF3";
    const muted  = root.getPropertyValue("--text-muted").trim() || "#8B949E";

    ctx.clearRect(0, 0, s, s);

    // Track
    ctx.lineCap = "round";
    ctx.lineWidth = thickness();
    ctx.strokeStyle = dim;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();

    // Value
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, sweepEnd);
    ctx.stroke();

    // Label/value text
    ctx.fillStyle = text;
    ctx.font = `700 ${s * 0.22}px Space Grotesk, Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const valueText = `${Math.round(props.value)}${props.unit ?? ""}`;
    ctx.fillText(valueText, cx, cy);

    if (props.label) {
      ctx.fillStyle = muted;
      ctx.font = `500 ${s * 0.08}px Inter, sans-serif`;
      ctx.fillText(props.label.toUpperCase(), cx, cy + s * 0.18);
    }
  };

  onMount(draw);
  createEffect(draw);

  return <canvas ref={canvas} />;
};
