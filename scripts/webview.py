#!/usr/bin/env python3
"""HYTE Dashboard - GTK WebKit fullscreen viewer with desktop toggle."""
import os
import subprocess
os.environ.setdefault("DISPLAY", ":0")

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, Gdk, GLib

DASHBOARD_URL = "http://127.0.0.1:8070"
CACHE_DIR = os.path.expanduser("~/.cache/hyte-dashboard")
os.makedirs(CACHE_DIR, exist_ok=True)


def find_hyte_monitor():
    display = Gdk.Display.get_default()
    n = display.get_n_monitors()
    for i in range(n):
        mon = display.get_monitor(i)
        model = mon.get_model() or ""
        geo = mon.get_geometry()
        if "DP-0" in model or "DP0" in model:
            return i
        if geo.width == 550 or geo.width == 1100:
            return i
    return n - 1


class DashboardWindow(Gtk.Window):
    def __init__(self):
        super().__init__()
        self.set_title("HYTEDash")
        self.set_decorated(False)
        self._minimized = False

        # Persistent cookies
        ctx = WebKit2.WebContext.get_default()
        cookie_mgr = ctx.get_cookie_manager()
        cookie_mgr.set_persistent_storage(
            os.path.join(CACHE_DIR, "cookies.db"),
            WebKit2.CookiePersistentStorage.SQLITE
        )
        cookie_mgr.set_accept_policy(WebKit2.CookieAcceptPolicy.ALWAYS)

        # WebView
        self.webview = WebKit2.WebView()
        wk = self.webview.get_settings()
        wk.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.NEVER)
        wk.set_enable_javascript(True)
        self.webview.set_zoom_level(0.5)
        self.webview.load_uri(DASHBOARD_URL)

        self.add(self.webview)
        self.connect("destroy", Gtk.main_quit)

    def go_fullscreen(self):
        screen = self.get_screen()
        target = find_hyte_monitor()
        print(f"Fullscreen on monitor {target}")
        self.fullscreen_on_monitor(screen, target)


def main():
    win = DashboardWindow()
    win.show_all()
    GLib.idle_add(win.go_fullscreen)
    Gtk.main()


if __name__ == "__main__":
    main()
