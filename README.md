# WeatherFlow + BOM Weather Card for Home Assistant

A custom Lovelace card for Australian Home Assistant users running a **WeatherFlow (Tempest)** weather station alongside a **Bureau of Meteorology (BOM)** weather integration. Combines live station readings with BOM's 5-day forecast and hourly rain probability into one compact card, with a tap-to-expand scrollable rain graph.

![Card overview](images/card-overview.png)

## Features

### Box 1 / Box 2 — Temp & Humidity

Live temperature and humidity from your WeatherFlow station, falling back to BOM data if the station goes offline. These update reactively, immediately reflecting whatever your WeatherFlow station's own sensors report — there's no polling interval controlled by this card, it just re-renders the instant the underlying entity changes.

### Box 3 — Auto-priority reading, tap to cycle manually

Box 3 automatically shows whichever condition is most relevant right now, in priority order — a genuine extreme (high wind gust, extreme rain, extreme lightning, extreme UV, or a large feels-like gap) always outranks a merely-active non-extreme condition, which in turn outranks the wind/feels-like default. Extremes get a pulsing indicator. Like boxes 1/2, this recomputes reactively whenever the underlying condition changes — it isn't on a timer.

![Rain reading](images/card-box3-rain.png)

**Tap Box 3** to manually cycle through readings instead: **wind → rain → lightning → UV → feels-like → wind → ...**. Wind and feels-like are always available to tap to; rain, lightning, and UV are automatically **skipped from the cycle whenever their value is currently inactive/zero** (e.g. no lightning strikes right now), so a tap never lands you on an empty "0" reading. A manual selection reverts to auto after 1 minute of inactivity, on a **double tap**, or immediately if a genuinely new condition becomes active while you're viewing a manual pin.

### 5-day forecast + hourly rain graph

A 5-day forecast table sourced from BOM, with day labels derived from each forecast entity's own date (not sensitive to BOM's forecast-reissue timing). The 5-day rows' own refresh cadence follows your BOM integration's own polling settings — this card doesn't control that. The card's own hourly-rain re-fetch (`weather.get_forecasts`, used for the tappable graph below) runs on a fixed 5-minute schedule plus once at Home Assistant startup, independent of your BOM integration's general polling.

Tap on Today or Tomorrow (when rain is forecast) to expand an inline, horizontally-scrollable hourly rain graph — smoothed curve, probability/mm/time labels, opens centered on the current hour.

![Graph view](images/card-graph-view.png)

Tap the graph to switch to a raw numeric grid instead; tap that to collapse, or double-tap the graph to collapse directly.

![Raw grid view](images/card-raw-view.png)

## Prerequisites

- A **WeatherFlow Tempest** weather station, set up via Home Assistant's WeatherFlow integration
- A **BOM (Bureau of Meteorology)** weather integration that exposes both a main `weather.*` entity (daily forecast) and a corresponding hourly-capable entity, plus per-day-index forecast sensors (temp max/min, rain chance, short text outlook) alongside it

## Installation

### 1. The card (via HACS)

Add this repository as a HACS custom repository (category: Lovelace), then install "WeatherFlow + BOM Weather Card." This installs `dash4-weather-card.js` as a Lovelace resource automatically.

Alternatively, copy `www/dash4-weather-card/dash4-weather-card.js` into your own `config/www/dash4-weather-card/` folder and add it manually as a Lovelace resource (Settings → Dashboards → Resources → Add Resource, type: JavaScript Module).

### 2. The data layer (manual copy — HACS can't install arbitrary YAML packages)

Copy these YAML files into your `config/packages/` folder:
- `packages/dash4_weather_card.yaml` — required
- `packages/dash4_public_config.yaml` — required
- `packages/dash4_box3_interaction.yaml` — optional, only needed if you want Box 3's tap-to-cycle behavior (see above); the card works fine without it, Box 3 just won't respond to taps

Edit `dash4_public_config.yaml`'s two `initial:` values before restarting:
- `dash4_weatherflow_prefix`: your WeatherFlow station's entity prefix. Find it by checking any of your station's sensors, e.g. `sensor.<this>_temperature` — the part between `sensor.` and `_temperature` is your prefix.
- `dash4_bom_prefix`: your BOM location's entity prefix. Find it via your `weather.<this>` entity, or the `sensor.<this>_temp_max_0`-style forecast sensors your BOM integration creates.

Restart Home Assistant (new `input_text`/`input_select`/`timer` helpers require a restart to appear).

### 3. Add the card to a dashboard

```yaml
type: custom:dash4-weather-card
entity: sensor.dash4_weather_card
uv_entity: sensor.<your_weatherflow_prefix>_uv_index
place_name: "YOUR HOUSE NAME"
```

`entity` defaults to `sensor.dash4_weather_card` if omitted (matching this package's sensor name — only change it if you renamed the sensor). `uv_entity` has no safe default — set it to your own station's UV sensor, or leave it unset if you don't want the UV reading. `place_name` defaults to `"MY HOME"` if omitted.

## Theming

The card's base layout (background, blur, text colors, dividers) follows your active Home Assistant theme automatically via standard HA CSS variables. The accent colors (rain teal, lightning amber, hot/cold red/blue, and the hourly graph's line/area) are fixed, not theme-derived — a deliberate design choice, not a bug.

## Notes

- Only Today and Tomorrow's forecast rows are ever tappable for the hourly graph — BOM's hourly forecast data reliably covers roughly the next 48 hours only.
- The card has no config-flow UI; all configuration is via the YAML shown above and the two `input_text` helpers.

## License

MIT — see [LICENSE](LICENSE).
