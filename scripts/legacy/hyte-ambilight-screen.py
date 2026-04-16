#!/usr/bin/env python3
"""
hyte-ambilight-screen.py — Anime artwork with reactive ambilight glow.

Displays a portrait artwork on the HYTE Y70 Touch panel. The ambilight color
from the TV drives a SCREEN-blend glow that illuminates the dark artwork
naturally — black areas stay black, lit areas catch the color.

Physical setup: HYTE screen is below the TV, roughly center-aligned.
TV light comes from above; radial glow emanates from the character center.

Resources: < 0.3% CPU at 3 Hz poll, ~20 MB RAM.
"""

from __future__ import annotations

import signal
import sys
import threading
import time
from pathlib import Path

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gtk, Gdk, GdkPixbuf, GLib

import cairo

# ── Config ───────────────────────────────────────────────────────────────────

ARTWORK_PATH = Path("/home/yaniss/projects/dashboard/assets/hyte-bg-portrait.jpg")
COLOR_FILE   = Path("/tmp/ambilight-color")   # written by ambilight_to_openrgb.py

POLL_HZ        = 20     # how often we read the shared color file (Hz)
MIN_DELTA      = 4      # skip lerp target update below this total RGB delta
COLOR_STALE_S  = 30.0   # seconds before treating missing/old file as TV-off

# Visual tuning
IMG_CENTER_Y   = 0.50   # image fills full screen height — centered at 50%
GLOW_CENTER_Y  = 0.50   # glow center: Bakugo centered at 50% of screen
GLOW_INTENSITY = 0.80   # radial glow strength (0–1, SCREEN blend: black = no effect)
GLOW_RADIUS    = 0.75   # radial glow radius as fraction of screen height
TOP_INTENSITY  = 0.55   # top-down gradient strength (TV light from above)
TOP_REACH      = 0.45   # how far down the top gradient reaches (fraction of screen)

FALLBACK_COLOR = (0.01, 0.02, 0.08)   # dark navy when TV is off



# ── GTK Window ────────────────────────────────────────────────────────────────

class AmbilightWindow(Gtk.Window):

    def __init__(self):
        super().__init__()
        self._lock = threading.Lock()
        self._color:  tuple[float, float, float] = FALLBACK_COLOR  # currently displayed
        self._target: tuple[float, float, float] = FALLBACK_COLOR  # latest fetched
        self._stop_event = threading.Event()

        # Detect portrait monitor (HYTE DP-0: 1100×3840)
        display = Gdk.Display.get_default()
        n = display.get_n_monitors()
        idx = next(
            (i for i in range(n)
             if (g := display.get_monitor(i).get_geometry()) and g.width < g.height),
            n - 1
        )
        geom = display.get_monitor(idx).get_geometry()
        self._x = geom.x
        self._y = geom.y
        self._w = geom.width
        self._h = geom.height

        # Pre-scale artwork once at startup
        self._pixbuf = self._load_artwork()

        self.set_title("hyte-ambilight")
        self.set_decorated(False)
        self.set_default_size(self._w, self._h)
        self.connect("realize", self._on_realize)

        da = Gtk.DrawingArea()
        da.connect("draw", self._draw)
        self.add(da)
        self.connect("destroy", self._on_destroy)
        self.show_all()

        # Smooth color interpolation at 30 fps (independent of 3 Hz TV poll)
        GLib.timeout_add(33, self._lerp_step)

    def _load_artwork(self) -> GdkPixbuf.Pixbuf | None:
        if not ARTWORK_PATH.exists():
            print(f"[hyte-ambilight] artwork not found: {ARTWORK_PATH}", file=sys.stderr)
            return None
        try:
            raw = GdkPixbuf.Pixbuf.new_from_file(str(ARTWORK_PATH))
            scale = self._w / raw.get_width()
            dst_h = int(raw.get_height() * scale)
            return raw.scale_simple(self._w, dst_h, GdkPixbuf.InterpType.BILINEAR)
        except Exception as e:
            print(f"[hyte-ambilight] artwork load error: {e}", file=sys.stderr)
            return None

    def _on_realize(self, _widget) -> None:
        # override_redirect bypasses GNOME HiDPI coordinate mangling
        gdk_win = self.get_window()
        gdk_win.set_override_redirect(True)
        gdk_win.move(self._x, self._y)
        gdk_win.resize(self._w, self._h)

    # ── Drawing ───────────────────────────────────────────────────────────────

    def _draw(self, widget, cr: cairo.Context) -> bool:
        w = widget.get_allocated_width() or self._w
        h = widget.get_allocated_height() or self._h

        with self._lock:
            r, g, b = self._color

        # 1. Black fill
        cr.set_operator(cairo.Operator.OVER)
        cr.set_source_rgb(0, 0, 0)
        cr.paint()

        # 2. Artwork: scaled to screen width, vertically centered at IMG_CENTER_Y
        if self._pixbuf:
            img_h = self._pixbuf.get_height()
            y_off = h * IMG_CENTER_Y - img_h * 0.5
            Gdk.cairo_set_source_pixbuf(cr, self._pixbuf, 0, y_off)
            cr.paint()

        # 3. Environment glow — SCREEN blend, black = no effect on Bakugo
        #    Inverted radial: black at character center → colored at edges.
        #    Top/bottom linear: atmosphere from the dark zones outward.
        cr.set_operator(cairo.Operator.SCREEN)

        cx = w * 0.5
        cy = h * GLOW_CENTER_Y
        gi = GLOW_INTENSITY

        # Inverted radial: protects center (Bakugo), illuminates surrounding darkness
        protect_r  = h * 0.18   # inner dead zone — no glow on character
        env_r      = h * GLOW_RADIUS
        inv = cairo.RadialGradient(cx, cy, protect_r, cx, cy, env_r)
        inv.add_color_stop_rgb(0.00, 0,             0,             0            )  # inner: no effect
        inv.add_color_stop_rgb(0.25, r * gi * 0.25, g * gi * 0.25, b * gi * 0.25)
        inv.add_color_stop_rgb(0.60, r * gi * 0.65, g * gi * 0.65, b * gi * 0.65)
        inv.add_color_stop_rgb(1.00, r * gi,        g * gi,        b * gi       )
        cr.set_source(inv)
        cr.paint()

        # Top gradient: TV light washing down from above
        ti = TOP_INTENSITY
        top = cairo.LinearGradient(0, 0, 0, h * TOP_REACH)
        top.add_color_stop_rgb(0.00, r * ti,        g * ti,        b * ti       )
        top.add_color_stop_rgb(0.45, r * ti * 0.35, g * ti * 0.35, b * ti * 0.35)
        top.add_color_stop_rgb(1.00, 0,             0,             0            )
        cr.set_source(top)
        cr.paint()

        # Bottom gradient: ground reflection
        bot = cairo.LinearGradient(0, h, 0, h * (1.0 - TOP_REACH))
        bot.add_color_stop_rgb(0.00, r * ti * 0.6,  g * ti * 0.6,  b * ti * 0.6 )
        bot.add_color_stop_rgb(0.50, r * ti * 0.20, g * ti * 0.20, b * ti * 0.20)
        bot.add_color_stop_rgb(1.00, 0,             0,             0            )
        cr.set_source(bot)
        cr.paint()

        cr.set_operator(cairo.Operator.OVER)
        return False

    # ── Update API ────────────────────────────────────────────────────────────

    def update_dominant(self, r: int, g: int, b: int) -> None:
        with self._lock:
            self._target = (r / 255.0, g / 255.0, b / 255.0)

    def set_fallback(self) -> None:
        with self._lock:
            self._target = FALLBACK_COLOR

    def _lerp_step(self) -> bool:
        """30 fps lerp: smoothly chase _target. Returns True to keep the timer alive."""
        SPEED = 0.18   # fraction of remaining gap closed per frame (~3 frames to 90% there)
        with self._lock:
            cr, cg, cb = self._color
            tr, tg, tb = self._target
            nr = cr + (tr - cr) * SPEED
            ng = cg + (tg - cg) * SPEED
            nb = cb + (tb - cb) * SPEED
            changed = abs(nr - cr) + abs(ng - cg) + abs(nb - cb) > 0.001
            self._color = (nr, ng, nb)
        if changed:
            self.queue_draw()
        return True  # keep timer alive

    def _invalidate(self) -> bool:
        self.queue_draw()
        return False

    def _on_destroy(self, _w) -> None:
        self._stop_event.set()
        Gtk.main_quit()


# ── Fetcher thread ────────────────────────────────────────────────────────────
# Reads /tmp/ambilight-color written by ambilight_to_openrgb.py (the master poller).
# Single TV poll source → all devices (LEDs + screen) see the same color at the same time.

def read_color_file() -> tuple[int, int, int] | None:
    """Read dominant color from shared file. Returns None if missing or stale."""
    try:
        stat = COLOR_FILE.stat()
        if time.time() - stat.st_mtime > COLOR_STALE_S:
            return None
        parts = COLOR_FILE.read_text().split()
        return int(parts[0]), int(parts[1]), int(parts[2])
    except Exception:
        return None


def fetcher(win: AmbilightWindow) -> None:
    period = 1.0 / max(POLL_HZ, 1)
    last_color: tuple[int, int, int] = (0, 0, 0)

    while not win._stop_event.is_set():
        t0 = time.monotonic()

        color = read_color_file()
        if color is None:
            win.set_fallback()
            win._stop_event.wait(timeout=2.0)
            continue

        r, g, b = color
        pr, pg, pb = last_color
        if abs(r - pr) + abs(g - pg) + abs(b - pb) >= MIN_DELTA:
            last_color = color
            win.update_dominant(r, g, b)

        remaining = period - (time.monotonic() - t0)
        if remaining > 0:
            win._stop_event.wait(timeout=remaining)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    win = AmbilightWindow()

    def _sig(_s, _f):
        win._stop_event.set()
        GLib.idle_add(Gtk.main_quit)

    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    t = threading.Thread(target=fetcher, args=(win,), daemon=True, name="ambilight-fetcher")
    t.start()

    Gtk.main()


if __name__ == "__main__":
    main()
