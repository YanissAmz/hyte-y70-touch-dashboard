#!/usr/bin/env python3
"""Bouton flottant "Retour Dashboard" affiché en mode bureau sur le HYTE."""
import os
import pathlib
import sys

os.environ.setdefault("DISPLAY", ":0")

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib

SIGNAL_FILE = pathlib.Path("/tmp/hyte-desktop-mode")
# Détection du moniteur HYTE (DP-0) pour positionner le bouton
HYTE_WIDTH = 1100
HYTE_HEIGHT = 3840


def find_hyte_geometry():
    """Retourne (x_offset, y_offset, width, height) du moniteur HYTE."""
    display = Gdk.Display.get_default()
    n = display.get_n_monitors()
    for i in range(n):
        mon = display.get_monitor(i)
        model = mon.get_model() or ""
        geo = mon.get_geometry()
        sf = mon.get_scale_factor()
        # Chercher DP-0 ou un écran de la bonne taille
        if "DP-0" in model or "DP0" in model:
            return geo.x, geo.y, geo.width * sf, geo.height * sf
        if geo.width in (550, 1100):
            return geo.x, geo.y, geo.width * sf, geo.height * sf
    # Fallback : dernier moniteur
    mon = display.get_monitor(n - 1)
    geo = mon.get_geometry()
    sf = mon.get_scale_factor()
    return geo.x, geo.y, geo.width * sf, geo.height * sf


class FloatButton(Gtk.Window):
    BUTTON_W = 160
    BUTTON_H = 60

    def __init__(self):
        super().__init__(type=Gtk.WindowType.POPUP)
        self.set_decorated(False)
        self.set_keep_above(True)
        self.set_accept_focus(False)
        self.set_app_paintable(True)

        # Transparence si le compositeur le supporte
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual:
            self.set_visual(visual)

        # Position : coin bas-droit du HYTE
        hx, hy, hw, hh = find_hyte_geometry()
        # On travaille en coordonnées logiques GDK (÷ scale factor)
        display = Gdk.Display.get_default()
        mon_idx = 0
        for i in range(display.get_n_monitors()):
            m = display.get_monitor(i)
            g = m.get_geometry()
            if g.x == hx and g.y == hy:
                mon_idx = i
                break
        mon = display.get_monitor(mon_idx)
        geo = mon.get_geometry()
        margin = 20
        bx = geo.x + geo.width - self.BUTTON_W - margin
        by = geo.y + geo.height - self.BUTTON_H - margin
        self.move(bx, by)
        self.resize(self.BUTTON_W, self.BUTTON_H)

        # Bouton
        btn = Gtk.Button(label="⌂  Dashboard")
        btn.set_relief(Gtk.ReliefStyle.NONE)
        btn.connect("clicked", self._on_click)

        # Style CSS
        css = b"""
        window {
            background: rgba(20, 20, 30, 0.88);
            border-radius: 12px;
            border: 1px solid rgba(88, 166, 255, 0.5);
        }
        button {
            background: transparent;
            color: #58A6FF;
            font-size: 16px;
            font-weight: bold;
            padding: 8px 16px;
            border: none;
            border-radius: 12px;
        }
        button:hover {
            background: rgba(88, 166, 255, 0.15);
        }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_screen(
            screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        self.add(btn)
        self.connect("destroy", Gtk.main_quit)

    def _on_click(self, _btn):
        SIGNAL_FILE.write_text("exit")
        Gtk.main_quit()


def main():
    win = FloatButton()
    win.show_all()
    Gtk.main()


if __name__ == "__main__":
    main()
