"""Utilitaires GTK/GDK partagés pour localiser le moniteur HYTE.

Utilisé par webview.py et float_button.py pour garantir qu'ils ciblent le même
écran physique indépendamment du GPU (nvidia/amdgpu) et de la config multi-moniteur.

Détection par géométrie (portrait 1100x3840 ou scale=2 équivalent 550x1920).
Fallback par nom de connecteur pour les setups legacy.
"""
import gi
gi.require_version('Gdk', '3.0')
from gi.repository import Gdk


_HYTE_WIDTHS  = (550, 1100, 3840)
_HYTE_HEIGHTS = (1100, 1920, 3840)


def find_hyte_monitor_index(screen=None) -> int:
    """Retourne l'index GTK du moniteur HYTE.

    Stratégie :
      1. Match géométrique : panneau HYTE en portrait 1100x3840
         (ou 550x1920 en logical avec scale=2), avec fallback paysage 3840x1100
      2. Fallback : connecteur nommé DisplayPort-0 (amdgpu) ou DP-0 (nvidia legacy)
      3. Dernier moniteur (safety)
    """
    screen = screen or Gdk.Screen.get_default()
    n = screen.get_n_monitors()

    # 1. Géométrie (source de vérité — fonctionne sur tout driver/GPU)
    for i in range(n):
        geo = screen.get_monitor_geometry(i)
        if geo.width in _HYTE_WIDTHS and geo.height in _HYTE_HEIGHTS:
            return i

    # 2. Connecteur par nom (fallback legacy)
    for i in range(n):
        name = screen.get_monitor_plug_name(i) or ""
        if any(tag in name for tag in ("DisplayPort-0", "DP-0", "DP0")):
            return i

    return n - 1


def get_hyte_geometry():
    """Retourne (x, y, logical_w, logical_h, scale) du moniteur HYTE."""
    screen = Gdk.Screen.get_default()
    idx = find_hyte_monitor_index(screen)
    geo = screen.get_monitor_geometry(idx)
    scale = screen.get_monitor_scale_factor(idx) or 1
    return geo.x, geo.y, geo.width, geo.height, scale
