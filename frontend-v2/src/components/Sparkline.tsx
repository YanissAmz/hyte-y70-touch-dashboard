import { onMount, createEffect, type Component } from "solid-js";

type Props = {
  values: number[];    // latest N samples, 0–max
  max?: number;        // y-axis max (default: auto)
  width?: number;
  height?: number;
  fill?: boolean;
};

export const Sparkline: Component<Props> = (props) => {
  let canvas: HTMLCanvasElement | undefined;
  const width  = () => props.width  ?? 300;
  const height = () => props.height ?? 60;

  let sized = false;

  const draw = (): void => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = width(), h = height();
    if (!sized) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      sized = true;
    }
    ctx.clearRect(0, 0, w, h);

    const values = props.values;
    if (values.length < 2) return;

    const max = props.max ?? Math.max(...values, 1);
    const min = 0;
    const range = Math.max(max - min, 1);
    const stepX = w / (values.length - 1);

    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue("--accent").trim() || "#7DAAFF";
    const glow   = root.getPropertyValue("--accent-glow").trim() || "rgba(125,170,255,0.18)";

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (props.fill ?? true) {
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
    }
  };

  onMount(draw);
  createEffect(draw);

  return <canvas ref={canvas} />;
};
