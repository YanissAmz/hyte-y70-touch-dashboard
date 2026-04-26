# Screenshots — drop them here

The README under [Demo](../../README.md#demo) reserves slots for these
captures. Naming and placement matter — once a file lands at one of the
paths below, the README auto-renders it.

| Suggested filename | What to capture |
|---|---|
| `panel_on_case.jpg` | Phone shot of the HYTE Y70 Touch panel showing the dashboard live, case visible |
| `dashboard_main.png` | Browser screenshot of the Main page (`/v2/`) at 1100×3840 portrait |
| `dashboard_games.png` | Games page with auto-detected launchers |
| `dashboard_controls.png` | Controls page (LED wheel + presets visible) |
| `dashboard_ambient.png` | Ambient page reacting to a TV color |
| `swipe_demo.gif` | Short clip swiping through all 10 pages, captured from the panel |
| `leds_demo.gif` | Short clip of the LED color cycle running |

Capture commands that work on this rig:

```bash
# Dashboard browser screenshot at the panel's portrait resolution:
DISPLAY=:1 scrot --focused docs/screenshots/dashboard_main.png

# GIF of the panel itself (point a phone, or use ffmpeg on :1):
ffmpeg -y -f x11grab -framerate 20 -video_size 1100x3840 -i :1.0 \
  -t 8 -vf "fps=15,scale=275:-1:flags=lanczos" \
  docs/screenshots/swipe_demo.gif
```

Once added, edit the [Demo section](../../README.md#demo) to inline them:

```markdown
![Panel on case](docs/screenshots/panel_on_case.jpg)
![Swiping through the dashboard](docs/screenshots/swipe_demo.gif)
```

Keep individual files under ~2 MB so the repo stays light. For longer
clips, prefer a YouTube/Vimeo link in the README.
