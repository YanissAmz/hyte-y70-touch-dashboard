#!/bin/bash
# HYTE Y70 Touch Web Dashboard - Startup Script
export DISPLAY=:0
DASHBOARD_DIR="/home/yaniss/dashboard"

# Wait for X display
while ! DISPLAY=:0 xdpyinfo &>/dev/null 2>&1; do
    sleep 2
done
sleep 3

# Configure screens: adapt to TV being plugged in or not
if xrandr | grep -q "HDMI-0 connected"; then
    xrandr --output HDMI-0 --auto --primary \
           --output DP-0 --auto --right-of HDMI-0 --rotate right
else
    xrandr --output DP-0 --auto --rotate right --primary
fi
sleep 2

# Fix touch input rotation — matrix depends on single vs dual monitor
# In dual-monitor, DP-0 is right of HDMI: need to scale+offset coords to DP-0
_apply_touch_matrix() {
    local SCREEN_W SCREEN_H DP0_X DP0_W DP0_H C1 C2
    SCREEN_W=$(xrandr | grep "^Screen 0" | grep -oP 'current \K[0-9]+')
    SCREEN_H=$(xrandr | grep "^Screen 0" | grep -oP 'current [0-9]+ x \K[0-9]+')
    DP0_X=$(xrandr | grep "^DP-0 connected" | grep -oP '\+\K[0-9]+(?=\+)')
    DP0_W=$(xrandr | grep "^DP-0 connected" | grep -oP '[0-9]+(?=x[0-9]+\+)')
    DP0_H=$(xrandr | grep "^DP-0 connected" | grep -oP '(?<=x)[0-9]+(?=\+)')
    # Matrix: [0, DP0_W/SCREEN_W, DP0_X/SCREEN_W, -1, 0, 1, 0, 0, 1]
    C1=$(python3 -c "print(f'{$DP0_W/$SCREEN_W:.6f}')")
    C2=$(python3 -c "print(f'{$DP0_X/$SCREEN_W:.6f}')")
    for name in "ILITEK       ILITEK-TOUCH" "ILITEK       ILITEK-TOUCH Mouse"; do
        xinput set-prop "$name" "Coordinate Transformation Matrix" \
            0 "$C1" "$C2" -1 0 1 0 0 1 2>/dev/null
    done
}
_apply_touch_matrix

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Démarrer le serveur OpenRGB si disponible (LEDs ARGB)
if command -v openrgb &>/dev/null; then
    if ! pgrep -x openrgb &>/dev/null; then
        openrgb --server --noautoconnect &>/dev/null &
        sleep 2
    fi
fi

# Kill existing instances
pkill -f "uvicorn backend.main" 2>/dev/null
pkill -f "webview.py" 2>/dev/null
pkill -f "float_button.py" 2>/dev/null
sleep 1

# Start backend
cd "$DASHBOARD_DIR"
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8070 --log-level warning &
BACKEND_PID=$!
sleep 3

# Launch WebKit fullscreen viewer on HYTE (système python3, pas le venv — gi est une lib système)
/usr/bin/python3 "$DASHBOARD_DIR/scripts/webview.py" &

# Re-apply touch matrix after GNOME settles (GNOME can reset it after login)
sleep 8
_apply_touch_matrix

wait $BACKEND_PID
