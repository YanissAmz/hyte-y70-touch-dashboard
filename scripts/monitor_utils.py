"""Utilitaires GTK/GDK partagés pour localiser le moniteur HYTE (DP-0).

Utilisé par webview.py et float_button.py pour garantir qu'ils ciblent le même
écran physique indépendamment de la config multi-moniteur en cours.
"""
import gi
gi.require_version('Gdk', '3.0')
from gi.repository import Gdk


def find_hyte_monitor_index(screen=None) -> int:
    """Retourne l'index GTK du moniteur HYTE (DP-0). Fallback : dernier moniteur."""
    screen = screen or Gdk.Screen.get_default()
    n = screen.get_n_monitors()
    for i in range(n):
        name = screen.get_monitor_plug_name(i) or ""
        if "DP-0" in name or "DP0" in name:
            return i
    # Fallback géométrique : portrait 1100x3840 (ou 550x1920 en logique scale=2)
    for i in range(n):
        geo = screen.get_monitor_geometry(i)
        if geo.width in (550, 1100) and geo.height in (1920, 3840):
            return i
    return n - 1


def get_hyte_geometry():
    """Retourne (x, y, logical_w, logical_h, scale) du moniteur HYTE."""
    screen = Gdk.Screen.get_default()
    idx = find_hyte_monitor_index(screen)
    geo = screen.get_monitor_geometry(idx)
    scale = screen.get_monitor_scale_factor(idx) or 1
    return geo.x, geo.y, geo.width, geo.height, scale
