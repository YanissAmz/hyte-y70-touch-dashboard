#!/usr/bin/env python3
"""HYTE Dashboard - GTK WebKit fullscreen viewer avec mode bureau."""
import os
import pathlib
import subprocess
import sys

os.environ.setdefault("DISPLAY", ":0")

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, Gdk, GLib

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://127.0.0.1:8070/")
CACHE_DIR = os.path.expanduser("~/.cache/hyte-dashboard")
SIGNAL_FILE = pathlib.Path("/tmp/hyte-desktop-mode")
FLOAT_BUTTON_SCRIPT = os.path.join(os.path.dirname(__file__), "float_button.py")
INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000  # 5 minutes

os.makedirs(CACHE_DIR, exist_ok=True)


sys.path.insert(0, os.path.dirname(__file__))
from monitor_utils import find_hyte_monitor_index as find_hyte_monitor
from monitor_utils import get_hyte_geometry


def find_hyte_xrandr_index():
    """Parse xrandr --listmonitors pour trouver l'index du moniteur HYTE (1100x3840 portrait).

    Détection par résolution (pas par nom de connecteur) pour supporter nvidia et amdgpu.
    Format xrandr: ' 1: +DisplayPort-0 1100/340x3840/100+3840+0  DisplayPort-0'
    """
    import re
    try:
        out = subprocess.check_output(["xrandr", "--listmonitors"]).decode()
        for line in out.splitlines():
            line = line.strip()
            parts = line.split(":", 1)
            if len(parts) != 2 or not parts[0].strip().isdigit():
                continue
            # Extract resolution from format like "1100/340x3840/100"
            if re.search(r"\b1100/\d+x3840/\d+", parts[1]):
                return int(parts[0].strip())
    except Exception:
        pass
    return 0


# Legacy alias (kept for safety in case of import refs elsewhere)
find_dp0_xrandr_index = find_hyte_xrandr_index


def pin_fullscreen_to_monitor(xid: int, mon_idx: int):
    """Send _NET_WM_FULLSCREEN_MONITORS client message to constrain fullscreen to a specific xrandr monitor."""
    try:
        from Xlib import display as xdisplay, X
        d = xdisplay.Display()
        root = d.screen().root
        win = d.create_resource_object('window', xid)
        atom_fsm = d.intern_atom('_NET_WM_FULLSCREEN_MONITORS')
        atom_state = d.intern_atom('_NET_WM_STATE')
        atom_full = d.intern_atom('_NET_WM_STATE_FULLSCREEN')
        mask = X.SubstructureRedirectMask | X.SubstructureNotifyMask
        # Remove fullscreen first
        root.send_event(xdisplay.event.ClientMessage(
            window=win, client_type=atom_state,
            data=(32, [0, atom_full, 0, 0, 0])
        ), event_mask=mask, propagate=False)
        d.sync()
        # Set fullscreen monitor hint (top, bottom, left, right, source)
        root.send_event(xdisplay.event.ClientMessage(
            window=win, client_type=atom_fsm,
            data=(32, [mon_idx, mon_idx, mon_idx, mon_idx, 1])
        ), event_mask=mask, propagate=False)
        d.sync()
        # Re-enable fullscreen
        root.send_event(xdisplay.event.ClientMessage(
            window=win, client_type=atom_state,
            data=(32, [1, atom_full, 0, 0, 0])
        ), event_mask=mask, propagate=False)
        d.sync()
        d.close()
    except Exception as e:
        print(f"pin_fullscreen_to_monitor error: {e}")


class DashboardWindow(Gtk.Window):
    def __init__(self):
        super().__init__()
        self.set_title("HYTEDash")
        self.set_decorated(False)
        self.set_keep_above(True)
        self._minimized = False
        self._float_proc = None
        self._inactivity_timer = None

        # On GNOME's X :0 the WM mangles window coordinates under HiDPI (GNOME
        # scale=2 on primary HDMI causes move(3840,0) to land at x=7680).
        # override_redirect bypasses the WM entirely so we can position the
        # window at exact physical X11 coordinates. Applied in the realize
        # signal since the GDK window doesn't exist before that.
        self.connect("realize", self._on_realize)

        hx, hy, hw, hh, _ = get_hyte_geometry()
        self._hyte_x = hx
        self._hyte_y = hy
        self._hyte_w = hw
        self._hyte_h = hh
        self.set_default_size(hw, hh)

        # WebKit context
        ctx = WebKit2.WebContext.get_default()
        ctx.set_cache_model(WebKit2.CacheModel.DOCUMENT_VIEWER)
        cookie_mgr = ctx.get_cookie_manager()
        cookie_mgr.set_persistent_storage(
            os.path.join(CACHE_DIR, "cookies.db"),
            WebKit2.CookiePersistentStorage.SQLITE
        )
        cookie_mgr.set_accept_policy(WebKit2.CookieAcceptPolicy.ALWAYS)

        # Content manager pour recevoir les messages JS
        self._content_mgr = WebKit2.UserContentManager()
        self._content_mgr.register_script_message_handler("dashboard")
        self._content_mgr.connect(
            "script-message-received::dashboard", self._on_js_message
        )

        # WebView
        self.webview = WebKit2.WebView.new_with_user_content_manager(
            self._content_mgr
        )
        wk = self.webview.get_settings()
        wk.set_enable_javascript(True)
        wk.set_enable_page_cache(False)
        # Zoom adaptatif : le frontend est calibré pour une viewport CSS de 1100px.
        # WebKit reçoit le logical width de GTK (= physique / scale). Donc zoom = 1/scale
        # pour que la CSS viewport reste à 1100 quel que soit le scale GNOME (qui change
        # quand une TV 4K est branchée en HDMI primary).
        self._apply_adaptive_zoom()
        self.webview.load_uri(DASHBOARD_URL)

        self.add(self.webview)
        try:
            import gi
            gi.require_version('Gdk', '3.0')
            from gi.repository import Gdk
            rgba = Gdk.RGBA()
            rgba.parse('#ff00ff')
            self.override_background_color(Gtk.StateFlags.NORMAL, rgba)
        except Exception:
            pass
        self.connect("destroy", Gtk.main_quit)

        # Recalcul du zoom quand la config multi-moniteur change (hotplug TV)
        Gdk.Screen.get_default().connect("monitors-changed", lambda s: self._apply_adaptive_zoom())

        # Polling signal file pour les commandes externes (float_button, API)
        GLib.timeout_add(1500, self._check_signal)

    def _on_realize(self, _widget):
        """Bypass GNOME WM via override_redirect, then pin to HYTE geometry.

        Without this, the WM applies its HiDPI coordinate logic which doubles
        physical X offsets under primary-monitor scale=2 (the HYTE ends up at
        x=7680 instead of 3840).
        """
        gdk_win = self.get_window()
        if gdk_win is None:
            return
        gdk_win.set_override_redirect(True)
        gdk_win.move(self._hyte_x, self._hyte_y)
        gdk_win.resize(self._hyte_w, self._hyte_h)

    def _apply_adaptive_zoom(self):
        """Compensate GNOME monitor scale + text-scaling-factor so CSS viewport
        stays at physical 1100px regardless of user accessibility settings."""
        screen = Gdk.Screen.get_default()
        scale = screen.get_monitor_scale_factor(find_hyte_monitor()) or 1
        text_scale = 1.0
        try:
            from gi.repository import Gio
            settings = Gio.Settings.new("org.gnome.desktop.interface")
            text_scale = settings.get_double("text-scaling-factor") or 1.0
        except Exception:
            pass
        self.webview.set_zoom_level(1.0 / (scale * text_scale))

    def _on_js_message(self, manager, result):
        """Reçoit les messages du JS via window.webkit.messageHandlers.dashboard.postMessage()"""
        try:
            msg = result.get_js_value().to_string()
        except Exception:
            return
        if msg == "desktop-mode":
            self.enter_desktop_mode()
        elif msg == "restore":
            self.restore_dashboard()
        elif msg.startswith("http://") or msg.startswith("https://"):
            self.enter_browser_mode(msg)

    def _check_signal(self):
        """Poll le fichier signal pour les commandes du float_button et de l'API REST."""
        if SIGNAL_FILE.exists():
            try:
                cmd = SIGNAL_FILE.read_text().strip()
                SIGNAL_FILE.unlink(missing_ok=True)
                if cmd == "enter":
                    self.enter_desktop_mode()
                elif cmd == "exit":
                    self.restore_dashboard()
            except Exception:
                pass
        return True  # continuer le polling

    def go_fullscreen(self):
        screen = self.get_screen()
        target = find_hyte_monitor()
        # Under X :1 the HYTE runs without a window manager, so fullscreen hints
        # alone do not resize the window. Force the exact monitor geometry first.
        self.move(self._hyte_x, self._hyte_y)
        self.resize(self._hyte_w, self._hyte_h)
        self.fullscreen_on_monitor(screen, target)
        self.present()
        # Pin to xrandr monitor via EWMH (bypass GTK HiDPI coordinate bug in multi-monitor)
        gdk_win = self.get_window()
        if gdk_win is not None:
            xid = gdk_win.get_xid()
            mon_idx = find_hyte_xrandr_index()
            GLib.timeout_add(300, lambda: (pin_fullscreen_to_monitor(xid, mon_idx), False)[1])

    def enter_browser_mode(self, url: str):
        """Navigue vers une URL externe — mode navigateur."""
        self._minimized = True  # on considère qu'on n'est plus sur le dashboard
        self.webview.load_uri(url)
        if self._float_proc is None or self._float_proc.poll() is not None:
            try:
                self._float_proc = subprocess.Popen(
                    [sys.executable, FLOAT_BUTTON_SCRIPT],
                    env=dict(os.environ)
                )
            except Exception as e:
                print(f"float_button.py error: {e}")
        self._reset_inactivity_timer()

    def enter_desktop_mode(self):
        if self._minimized:
            return
        self._minimized = True
        self.unfullscreen()
        GLib.idle_add(self._do_iconify)

    def _do_iconify(self):
        self.iconify()
        # Lancer le bouton flottant
        if self._float_proc is None or self._float_proc.poll() is not None:
            try:
                self._float_proc = subprocess.Popen(
                    [sys.executable, FLOAT_BUTTON_SCRIPT],
                    env=dict(os.environ)
                )
            except Exception as e:
                print(f"float_button.py error: {e}")
        # Démarrer le timer d'inactivité
        self._reset_inactivity_timer()
        return False

    def restore_dashboard(self):
        if not self._minimized:
            return
        self._minimized = False
        # Tuer le bouton flottant
        if self._float_proc and self._float_proc.poll() is None:
            self._float_proc.terminate()
            self._float_proc = None
        # Annuler le timer d'inactivité
        if self._inactivity_timer is not None:
            GLib.source_remove(self._inactivity_timer)
            self._inactivity_timer = None
        # Si on était en mode navigateur, recharger le dashboard
        current = self.webview.get_uri() or ""
        if not current.startswith(DASHBOARD_URL):
            self.webview.load_uri(DASHBOARD_URL)
            GLib.idle_add(self.go_fullscreen)
        else:
            self.deiconify()
            self.present()
            GLib.idle_add(self.go_fullscreen)

    def _reset_inactivity_timer(self):
        if self._inactivity_timer is not None:
            GLib.source_remove(self._inactivity_timer)
        self._inactivity_timer = GLib.timeout_add(
            INACTIVITY_TIMEOUT_MS, self._on_inactivity
        )

    def _on_inactivity(self):
        """Retour automatique au dashboard après inactivité."""
        if self._minimized:
            self.restore_dashboard()
        self._inactivity_timer = None
        return False


def main():
    win = DashboardWindow()
    win.show_all()
    GLib.idle_add(win.go_fullscreen)
    Gtk.main()


if __name__ == "__main__":
    main()
