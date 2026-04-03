#!/usr/bin/env python3
"""HYTE Dashboard - GTK WebKit fullscreen viewer."""
import os
os.environ.setdefault("DISPLAY", ":0")

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, Gdk

URL = "http://127.0.0.1:8070"


class DashboardWindow(Gtk.Window):
    def __init__(self):
        super().__init__()
        self.set_title("HYTEDash")
        self.set_decorated(False)

        # WebView
        webview = WebKit2.WebView()
        settings = webview.get_settings()
        settings.set_hardware_acceleration_policy(
            WebKit2.HardwareAccelerationPolicy.NEVER
        )
        # Compensate for GNOME 2x scaling: render at 0.5 zoom so 1100x3840 CSS pixels
        # fill the 550x1920 logical viewport (which maps to 1100x3840 physical pixels)
        webview.set_zoom_level(0.5)
        webview.load_uri(URL)
        self.add(webview)

        self.connect("destroy", Gtk.main_quit)

    def on_screen(self):
        screen = self.get_screen()
        display = Gdk.Display.get_default()
        n = display.get_n_monitors()
        # Find the HYTE monitor (DP-0) or use the last one
        target = n - 1
        for i in range(n):
            mon = display.get_monitor(i)
            model = mon.get_model() or ""
            if "DP-0" in model or "DP0" in model:
                target = i
                break
        self.fullscreen_on_monitor(screen, target)


def main():
    win = DashboardWindow()
    win.show_all()
    win.on_screen()
    Gtk.main()


if __name__ == "__main__":
    main()
