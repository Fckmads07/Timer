# ⏱ Timer by Madhav

A time-keeping web app in plain HTML, CSS and JavaScript (no frameworks, no build step), with an animated background.

Open `Timer.html` in a browser to use it.

## Features

### 🕐 Clock
- Analog clock with smoothly sweeping hands and a glowing seconds ring
- Digital clock with an animated digit change, 12h / 24h modes and AM/PM
- Greeting that changes with the time of day, the full date (English or French) and a "% of the day done" bar
- World clocks (New York, London, Paris, Mumbai, Tokyo, Sydney) showing day/night, hour difference and Today/Tomorrow

### ⏱ Stopwatch
- Centisecond accuracy with a progress ring that does one turn per minute
- Laps with lap and total times; the fastest lap shows in green and the slowest in red

### ⏳ Timer (countdown)
- Set it by typing, by scrolling over the numbers, or with presets (1, 5, 10, 15 and 30 min, 1 h)
- `+1 min` works while the timer is running
- Shows the time the timer will end, and the ring pulses red in the last 10 seconds
- Alarm popup with a chime (Web Audio, no sound files), a snooze button and a desktop notification
- The remaining time shows in the browser tab title

### 🍅 Pomodoro
- Focus, short-break and long-break phases, with a long break after every 4 focus sessions
- Each phase has its own colour, and progress dots track the 4-session cycle
- Can start the next phase on its own, and counts the focus sessions completed today

### 🎨 Animated background (choose it in ⚙ Settings)
| Mode | Description |
|------|-------------|
| **Network** | Drifting particles that link up and move away from the mouse |
| **Warp** | Hyperspace starfield; the mouse steers the vanishing point |
| **Waves** | Layered flowing waves that swell under the cursor |
| **Photo** | The original photo slowly zooming, with floating bokeh lights |

Animated aurora blobs sit behind every mode.

### ⚙ Settings (saved in the browser)
Accent colour · background mode · 24-hour clock · sounds · French date · Pomodoro auto-start · Pomodoro lengths

## Keyboard shortcuts
| Key | Action |
|-----|--------|
| `1` – `4` | Switch tab |
| `Space` | Start / pause |
| `L` | Lap (stopwatch) |
| `R` | Reset |
| `F` | Fullscreen |
| `S` | Settings |
| `Esc` | Close settings / dismiss alarm |

You can link straight to a tab: `Timer.html#stopwatch`, `#timer` or `#pomodoro`.

## Files
- `Timer.html`: page structure
- `Timer.css`: styles, animations and responsive layout
- `Timer.js`: clock, stopwatch, timer, Pomodoro, settings and shortcuts
- `background.js`: the animated canvas background
