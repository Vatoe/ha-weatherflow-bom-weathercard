// DASH-4 Weather Card — native custom Lovelace card (compiled styling, no card_mod, no iframe)
// Reads sensor.dash4_weather_card's attributes directly via the hass object Lovelace
// hands to every custom card - no WebSocket connection/auth layer needed at all
// (unlike the old iframe version, which had to run in an isolated browsing context).

const ICON_MAP = {
  'sunny': '☀️', 'clear-night': '🌙', 'cloudy': '☁️',
  'partlycloudy': '⛅', 'pouring': '🌧️', 'rainy': '🌦️',
  'lightning': '⚡', 'lightning-rainy': '⛈️', 'snowy': '❄️',
  'snowy-rainy': '🌨️', 'fog': '🌫️', 'hail': '🧊',
  'windy': '💨', 'windy-variant': '💨', 'exceptional': '⚠️',
};

const STYLE = `
  :host { display: block; }
  * { box-sizing: border-box; }
  .card {
    background: var(--ha-card-background, rgba(0,0,0,0.3));
    backdrop-filter: var(--ha-card-backdrop-filter, blur(20px));
    -webkit-backdrop-filter: var(--ha-card-backdrop-filter, blur(20px));
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
    padding: 12px 18px 9px;
    color: var(--primary-text-color);
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .title-line {
    display: flex; flex-wrap: wrap; row-gap: 4px; justify-content: center;
    align-items: baseline; gap: 8px; font-family: 'Helvetica Neue', Arial, sans-serif;
    padding: 0 2px 5px; margin-bottom: 1px;
  }
  .title-line .tsep { font-size: 14px; font-weight: 300; color: var(--secondary-text-color); }
  .title-divider { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .title-divider .rule { flex: 1; height: 1px; background: var(--divider-color); }
  .title-divider .dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(150,150,150,0.85); flex-shrink: 0; }
  .title-line .place { font-size: 15px; font-weight: 300; letter-spacing: 1.6px; text-transform: uppercase; color: var(--primary-text-color); white-space: nowrap; }
  .title-line .date, .title-line .time { font-size: 15px; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; }
  .title-line .date { font-weight: 300; color: var(--primary-text-color); }
  .title-line .time { font-weight: 900; color: var(--primary-text-color); }

  .box-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px; }
  .box { background: rgba(255,255,255,0.07); border-radius: 12px; padding: 8px 10px; text-align: center; border: 1px solid rgba(255,255,255,0.10); overflow: hidden; }
  .box .label { font-size: 11.5px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
  .box .value { font-size: 26px; font-weight: 700; line-height: 1.05; color: var(--primary-text-color); }
  .box .sub { font-size: 12.5px; color: var(--secondary-text-color); margin-top: 2px; font-weight: 500; }
  .box:not(.box3) .value { font-size: 30px; margin-top: 3px; white-space: nowrap; }
  .box3.compact .value { font-size: 30px; margin-top: 3px; white-space: nowrap; }

  .box3.tappable { cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
  .box3.tappable:active { transform: scale(0.97); transition: transform 0.08s; }

  .box3.rain .value { color: #66D4CF; }
  .box3.lightning .value, .box3.wind-notable .value { color: #FF9F0A; }
  .box3.high-wind .value, .box3.uv-extreme .value,
  .box3.rain-extreme .value, .box3.lightning-extreme .value,
  .box.high-temp-extreme .value, .box3.feels-hotter-extreme .value {
    color: #FF453A; animation: text-pulse-red 4s ease-in-out infinite;
  }
  .box.high-temp .value, .box3.feels-hotter .value { color: #FF453A; }
  @keyframes text-pulse-red { 0%,100% { color: rgba(255,69,58,0.55); } 50% { color: rgba(255,69,58,1); } }
  .box.low-temp-extreme .value, .box3.feels-colder-extreme .value {
    color: #0A84FF; animation: text-pulse-blue 4s ease-in-out infinite;
  }
  .box.low-temp .value, .box3.feels-colder .value { color: #0A84FF; }
  @keyframes text-pulse-blue { 0%,100% { color: rgba(10,132,255,0.55); } 50% { color: rgba(10,132,255,1); } }

  .box3.multi-extreme { border-color: rgba(255,159,10,0.55); animation: border-pulse-amber 2.5s ease-in-out infinite; }
  @keyframes border-pulse-amber { 0%,100% { border-color: rgba(255,159,10,0.3); } 50% { border-color: rgba(255,159,10,0.85); } }

  table.forecast { width: 100%; border-collapse: collapse; font-size: 14.5px; margin-bottom: 4px; }
  table.forecast th { text-align: left; font-size: 10.5px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500; padding: 0 6px 3px; border-bottom: 1px solid var(--divider-color); }
  table.forecast td { padding: 3px 6px; border-bottom: 1px solid var(--divider-color); vertical-align: middle; color: var(--primary-text-color); }
  table.forecast tr:last-child td { border-bottom: none; }
  table.forecast td.day { font-weight: 600; width: 15%; }
  table.forecast td.icon { width: 8%; font-size: 21px; text-align: center; }
  table.forecast td.temp { width: 20%; color: var(--secondary-text-color); white-space: nowrap; }
  table.forecast td.temp b { color: var(--primary-text-color); font-weight: 600; }
  table.forecast td.rain { width: 14%; color: #66D4CF; }
  table.forecast td.desc { color: var(--secondary-text-color); }

  .alert-lines { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; padding: 5px 12px; border-left: 3px solid #66D4CF; }
  .alert-lines.warning { border-left-color: #FF453A; }
  .alert-lines .l1 { font-size: 13.5px; font-weight: 500; color: var(--primary-text-color); }
  .alert-lines .l2 { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
  .alert-lines .count-inline { font-size: 12px; color: var(--secondary-text-color); font-weight: 400; white-space: nowrap; }
  .alert-lines.tappable { cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
  .alert-lines.tappable:active { transform: scale(0.98); transition: transform 0.08s; }
  .forecast tr.tappable-row { cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
  .forecast tr.tappable-row:active { opacity: 0.7; }
  .hourly-detail-row td { padding: 6px 0 8px; max-width: 0; }
  .hourly-detail {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px 4px;
    padding: 6px 4px;
    background: rgba(255,255,255,0.04);
    border-radius: 8px;
  }
  .hourly-cell { text-align: center; font-size: 11px; line-height: 1.4; }
  .hourly-time { color: #66D4CF; opacity: 0.9; }
  .hourly-prob { font-weight: 600; }
  .hourly-mm { opacity: 0.7; }

  .hourly-graph-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    touch-action: pan-x;
    -webkit-overflow-scrolling: touch;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    background: rgba(255,255,255,0.04);
    border-radius: 8px;
    padding: 6px 4px;
    width: 100%;
    box-sizing: border-box;
  }
  .hourly-graph-content { position: relative; }
  .hourly-graph-svg { display: block; }
  .hourly-graph-area { fill: #66D4CF; fill-opacity: 0.18; stroke: none; }
  .hourly-graph-line { fill: none; stroke: #66D4CF; stroke-width: 2; }
  .hourly-graph-dot { fill: #66D4CF; }
  .hourly-graph-row { display: flex; }
  .hourly-graph-col { text-align: center; flex: 0 0 auto; font-size: 11px; line-height: 1.4; }
  .hourly-graph-more-note {
    text-align: center;
    font-size: 10px;
    line-height: 1.4;
    color: var(--secondary-text-color);
    opacity: 0.7;
    padding: 3px 0 0;
    font-style: italic;
  }
`;

function ordinal(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Fixed per-hour column width for the hourly rain graph (and its aligned
// mm/time label rows beneath it) - shared by the renderer and the initial
// scroll-centering math so they never drift out of sync with each other.
const GRAPH_COL_WIDTH = 44;

// Hourly forecast entries use labels like '6am' / '2pm' / '12am' - convert to
// a 0-23 hour number so we can locate "now" (or a given hour) as a column index.
function parseHourLabel(label) {
  const m = /^(\d{1,2})(am|pm)$/i.exec(String(label || '').trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const period = m[2].toLowerCase();
  if (period === 'am') { if (hour === 12) hour = 0; }
  else if (hour !== 12) { hour += 12; }
  return hour;
}

function findHourColumnIndex(hourlyData, hour) {
  for (let i = 0; i < hourlyData.length; i++) {
    if (parseHourLabel(hourlyData[i].time) === hour) return i;
  }
  return -1;
}

// Builds a smooth SVG path (cubic Beziers via a standard Catmull-Rom
// conversion, tension 0) through a list of {x,y} points, instead of the
// sharp-angled straight-line segments a plain 'L'-only path would produce.
// Returns an array of path command strings - first element is always the
// leading 'M' - so callers can splice in their own edge-extension segments
// before/after without re-parsing the string.
function catmullRomSegments(points) {
  if (!points.length) return [];
  if (points.length === 1) {
    return [`M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`];
  }
  const segs = [`M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    segs.push(`C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
  }
  return segs;
}

// Attaches a tap handler to a horizontally-scrollable element while ignoring
// touch gestures that turn out to be swipes/drags rather than taps - a plain
// 'click' listener alone can occasionally misfire after a drag-scroll release
// on some mobile browsers. Mouse interaction (no touch events) is unaffected.
function attachTapSwipeGuard(el, onTap) {
  let startX = 0;
  let startY = 0;
  let moved = false;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    moved = false;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) moved = true;
  }, { passive: true });
  el.addEventListener('click', (e) => {
    if (moved) {
      moved = false;
      return;
    }
    onTap(e);
  });
}

class Dash4WeatherCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // Safe defaults in case _render()/set hass() ever runs before setConfig()
    // is called (Lovelace doesn't guarantee call order) - setConfig() below
    // overwrites these with resolved config values (or the same defaults) as
    // soon as it runs.
    this._entityId = 'sensor.dash4_weather_card';
    this._uvEntityId = null;
    this._placeName = 'MY HOME';
    this._clickTimer = null;
    this._alertIndex = 0;
    this._expandedDay = null;
    this._expandTimer = null;
    // View mode ('graph'|'raw') for whichever day is currently expanded - only
    // one day is ever expanded at a time, so a single field is sufficient.
    // Always reset to 'graph' on every collapsed->expanded transition.
    this._viewMode = 'graph';
    // Single/double-tap disambiguation timer for taps on the graph itself.
    this._graphTapTimer = null;
    // Whether the initial scroll-to-center-on-now has already been applied
    // for the current expand - set true once consumed, reset false on every
    // fresh collapsed->expanded transition. Prevents periodic re-renders
    // (hass data refresh, timer-driven scroll reset) from re-centering and
    // yanking the view out from under an actively-scrolling user.
    this._centeringDone = false;
    // Last known scrollLeft of the expanded graph's scroll container - the
    // container is a brand-new DOM node every _render() (innerHTML rebuild),
    // so a fresh node always defaults to scrollLeft 0. Captured on every
    // scroll event and restored after each rebuild once centering has
    // already been applied once, so a periodic data refresh (~5 min) doesn't
    // silently snap an open panel back to the start of the day.
    this._savedScrollLeft = 0;
  }

  setConfig(config) {
    this._config = config || {};
    this._entityId = this._config.entity || 'sensor.dash4_weather_card';
    this._uvEntityId = this._config.uv_entity || null;
    this._placeName = this._config.place_name || 'MY HOME';
  }

  set hass(hass) {
    this._hass = hass;
    // set hass() fires on every state change house-wide, not just this card's own
    // entity - only re-render when something we actually display has changed.
    const entity = hass.states[this._entityId];
    const uvEntity = hass.states[this._uvEntityId];
    const key = `${entity ? entity.last_updated : ''}|${uvEntity ? uvEntity.state : ''}`;
    if (key === this._lastKey) return;
    this._lastKey = key;
    if (this._connected) this._render();
  }

  getCardSize() {
    return 9;
  }

  // Sections-view sizing API - rows intentionally omitted so the grid auto-sizes the
  // cell to actual rendered content instead of reserving a fixed-height track that can
  // never exactly match it (box3's alert-lines block is variable height: 0/1/2 lines,
  // cyclable). Same pattern used by mushroom.js for its own variable-height cards.
  getGridOptions() {
    return { columns: 12 };
  }

  connectedCallback() {
    this._connected = true;
    this._render();
    this._clockTimer = setInterval(() => this._renderTitleOnly(), 30000);
  }

  disconnectedCallback() {
    this._connected = false;
    if (this._clockTimer) clearInterval(this._clockTimer);
    if (this._clickTimer) {
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
    }
    if (this._expandTimer) {
      clearTimeout(this._expandTimer);
      this._expandTimer = null;
    }
    if (this._graphTapTimer) {
      clearTimeout(this._graphTapTimer);
      this._graphTapTimer = null;
    }
    // If the element is ever removed from the DOM while a row is expanded
    // (e.g. Lovelace re-rendering the view), collapse the state outright
    // rather than leaving it "expanded" with no running auto-collapse timer -
    // otherwise a later reconnect would redraw an open panel that can never
    // time out on its own (connectedCallback doesn't restart the timer).
    this._expandedDay = null;
    this._viewMode = 'graph';
    this._centeringDone = false;
  }

  _renderTitleOnly() {
    const dateEl = this.shadowRoot.querySelector('.date');
    const timeEl = this.shadowRoot.querySelector('.time');
    if (!dateEl || !timeEl) return;
    const n = new Date();
    const dayName = n.toLocaleDateString('en-AU', { weekday: 'short' });
    const month = n.toLocaleDateString('en-AU', { month: 'long' });
    dateEl.textContent = `${dayName} ${n.getDate()}${ordinal(n.getDate())} ${month}`;
    let h = n.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    const m = String(n.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${h}:${m} ${ampm}`;
  }

  _render() {
    if (!this._hass) {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="card"><div class="title-line">Loading&hellip;</div></div>`;
      return;
    }
    const entity = this._hass.states[this._entityId];
    if (!entity) {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="card"><div class="title-line">${escapeHtml(this._entityId)} unavailable</div></div>`;
      return;
    }
    const a = entity.attributes;
    const uvEntity = this._hass.states[this._uvEntityId];
    const uvIndex = uvEntity ? parseFloat(uvEntity.state) : NaN;
    const d = a.box3_display || {};
    const uvExtreme = d.cls === 'uv' && uvIndex >= 11;

    let box3Classes = 'box box3 tappable';
    if (d.cls) box3Classes += ' ' + d.cls;
    if (uvExtreme) box3Classes += ' uv-extreme';
    if (d.compact) box3Classes += ' compact';
    if ((parseInt(a.extreme_count, 10) || 0) >= 2) box3Classes += ' multi-extreme';

    const box1Class = 'box' + (a.box1_border && a.box1_border !== 'neutral' ? ' ' + a.box1_border : '');

    const forecastRows = a.forecast_rows || [];
    const hourlyToday = a.hourly_rain_today || [];
    const hourlyTomorrow = a.hourly_rain_tomorrow || [];
    const dayKeyFor = (day) => day === 'Today' ? 'today' : day === 'Tmow' ? 'tomorrow' : null;
    const hourlyDataFor = (key) => key === 'today' ? hourlyToday : key === 'tomorrow' ? hourlyTomorrow : [];
    const rows = forecastRows.map(row => {
      const dayKey = dayKeyFor(row.day);
      const isTappable = !!row.tappable && dayKey !== null;
      const isExpanded = isTappable && this._expandedDay === dayKey;
      const mainRow = `
      <tr class="${isTappable ? 'tappable-row' : ''}"${isTappable ? ` data-day-key="${dayKey}"` : ''}>
        <td class="day">${escapeHtml(row.day)}</td>
        <td class="icon">${ICON_MAP[(row.icon || '').replace('mdi:weather-', '')] || ''}</td>
        <td class="temp"><b>${escapeHtml(row.temp_max)}</b>&deg; / ${escapeHtml(row.temp_min)}&deg;</td>
        <td class="rain">${escapeHtml(row.rain_chance)}</td>
        <td class="desc">${escapeHtml(row.outlook)}</td>
      </tr>`;
      if (!isExpanded) return mainRow;
      const hourlyData = hourlyDataFor(dayKey);
      const viewMode = this._viewMode || 'graph';
      const content = viewMode === 'raw'
        ? this._renderRawGrid(hourlyData)
        : this._renderHourlyGraph(dayKey, hourlyData);
      const detailRow = `
      <tr class="hourly-detail-row">
        <td colspan="5">${content}</td>
      </tr>`;
      return mainRow + detailRow;
    }).join('');

    const alert = a.alert_lines || {};
    const alertTitles = alert.titles || (alert.line1 ? [alert.line1] : []);
    const alertCyclable = alertTitles.length > 1;
    const alertTitlesKey = alertTitles.join('|');
    if (alertTitlesKey !== this._lastAlertTitlesKey) {
      this._alertIndex = 0;
      this._lastAlertTitlesKey = alertTitlesKey;
    }
    const alertIdx = alertCyclable ? (this._alertIndex % alertTitles.length) : 0;
    const alertLine1 = alertCyclable ? alertTitles[alertIdx] : alert.line1;
    const alertLine2 = alertCyclable ? `${alertIdx + 1} of ${alertTitles.length}` : alert.line2;
    const alertShow = alertCyclable || !!alertLine1;

    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <div class="card">
        <div class="title-line">
          <span class="place">${escapeHtml(this._placeName)}</span>
          <span class="tsep">&middot;</span>
          <span class="date"></span>
          <span class="tsep">&middot;</span>
          <span class="time"></span>
        </div>
        <div class="title-divider"><span class="dot"></span><span class="rule"></span><span class="dot"></span></div>

        <div class="box-row">
          <div class="${box1Class}">
            <div class="label">Temp</div>
            <div class="value">${escapeHtml(a.box1_temp)}</div>
          </div>
          <div class="box">
            <div class="label">Humidity</div>
            <div class="value">${escapeHtml(a.box2_humidity)}</div>
          </div>
          <div class="${box3Classes}">
            <div class="label">${escapeHtml(d.label)}</div>
            <div class="value">${escapeHtml(d.value)}</div>
            ${d.sub ? `<div class="sub">${escapeHtml(d.sub)}</div>` : ''}
          </div>
        </div>

        <table class="forecast">
          <tr><th>Day</th><th></th><th>Temp</th><th>Rain</th><th>Outlook</th></tr>
          ${rows}
        </table>

        ${alertShow ? `
        <div class="alert-lines${alert.is_warning ? ' warning' : ''}${alertCyclable ? ' tappable' : ''}">
          <div class="l1">${escapeHtml(alertLine1 || '')}${alertCyclable ? ` <span class="count-inline">${escapeHtml(alertLine2)}</span>` : ''}</div>
          ${(!alertCyclable && alertLine2) ? `<div class="l2">${escapeHtml(alertLine2)}</div>` : ''}
        </div>` : ''}
      </div>
    `;
    this._renderTitleOnly();

    if (alertCyclable) {
      const alertEl = this.shadowRoot.querySelector('.alert-lines');
      if (alertEl) alertEl.addEventListener('click', () => {
        this._alertIndex = (this._alertIndex + 1) % alertTitles.length;
        this._render();
      });
    }

    const box3El = this.shadowRoot.querySelector('.box3');
    if (box3El) box3El.addEventListener('click', () => this._handleBox3Click());

    this.shadowRoot.querySelectorAll('.tappable-row').forEach(el => {
      el.addEventListener('click', () => this._handleForecastRowClick(el.dataset.dayKey));
    });

    if (this._expandedDay) {
      const viewMode = this._viewMode || 'graph';
      if (viewMode === 'graph') {
        const scrollEl = this.shadowRoot.querySelector('.hourly-graph-scroll');
        if (scrollEl) {
          attachTapSwipeGuard(scrollEl, (e) => {
            e.stopPropagation();
            this._handleGraphTap();
          });
          // Active swiping resets the auto-collapse timer so an in-progress
          // interaction never gets cut off mid-scroll, and captures the
          // current scroll position so a periodic rebuild (below) can
          // restore it instead of snapping back to a fresh node's default 0.
          scrollEl.addEventListener('scroll', () => {
            this._startExpandTimer();
            this._savedScrollLeft = scrollEl.scrollLeft;
          });

          if (!this._centeringDone) {
            this._centeringDone = true;
            const hourlyData = hourlyDataFor(this._expandedDay);
            const nowHour = new Date().getHours();
            const idx = findHourColumnIndex(hourlyData, nowHour);
            let initialScrollLeft = 0;
            if (idx >= 0) {
              const colCenterX = idx * GRAPH_COL_WIDTH + GRAPH_COL_WIDTH / 2;
              const target = colCenterX - scrollEl.clientWidth / 2;
              const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
              initialScrollLeft = Math.max(0, Math.min(target, maxScroll));
            }
            scrollEl.scrollLeft = initialScrollLeft;
            this._savedScrollLeft = initialScrollLeft;
          } else {
            // Not the first render of this expand (e.g. a periodic hass data
            // refresh rebuilt the DOM) - restore wherever the user had
            // actually scrolled to instead of re-centering or defaulting to 0.
            scrollEl.scrollLeft = this._savedScrollLeft;
          }
        }
      } else {
        const rawEl = this.shadowRoot.querySelector('.hourly-detail[data-view="raw"]');
        if (rawEl) {
          rawEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this._collapseExpanded();
          });
        }
      }
    }
  }

  // Existing time/prob%/mm grid (unchanged appearance from the prior spec) -
  // now renders whatever length list it's given (up to 24 entries) instead of
  // assuming exactly 15; grid-template-columns stays fixed at 5 and rows grow
  // naturally via CSS grid auto-placement.
  _renderRawGrid(hourlyData) {
    const cells = hourlyData.map(h => `
            <div class="hourly-cell">
              <div class="hourly-time">${escapeHtml(h.time)}</div>
              <div class="hourly-prob">${escapeHtml(h.prob)}%</div>
              <div class="hourly-mm">${escapeHtml(h.mm)}mm</div>
            </div>`).join('');
    return `<div class="hourly-detail" data-view="raw">${cells}</div>`;
  }

  // Scrollable SVG line/area chart of rain probability across the day, with
  // mm labels and hour labels beneath.
  _renderHourlyGraph(dayKey, hourlyData) {
    const colWidth = GRAPH_COL_WIDTH;
    const chartHeight = 54;
    const padTop = 4;
    const padBottom = 4;
    const usable = chartHeight - padTop - padBottom;
    const width = Math.max(hourlyData.length * colWidth, colWidth);

    const points = hourlyData.map((h, i) => {
      const x = i * colWidth + colWidth / 2;
      const prob = Math.max(0, Math.min(100, parseFloat(h.prob) || 0));
      const y = padTop + usable * (1 - prob / 100);
      return { x, y, prob };
    });

    // Left edge: if the first hour in view already has rain, extend the top
    // edge flat out to the true x=0 boundary at that same height, so the
    // line/area reads as continuing from off-screen. Left is never the
    // genuine end of all data (Today's left edge is just "now", Tomorrow's
    // is 12am immediately after Today's own last hour) - flat extension
    // stays correct here, unchanged.
    const extendLeft = points.length > 0 && points[0].prob > 0;

    // Right edge is different: it's always the true end of this array (both
    // Today and Tomorrow's lists end at 11pm, with no further hours anywhere
    // in this graph) - flat-extending there previously implied "more data to
    // scroll to," which isn't true. If the last hour has rain, taper down to
    // baseline instead. The curve through the real points is computed first,
    // untouched by this - feeding a synthetic zero point straight into
    // catmullRomSegments() let it pull the LAST REAL point's own tangent
    // (Catmull-Rom looks at each point's neighbors on both sides), bulging
    // the line upward right before the drop even though that hour's own
    // reading was flat/unchanged from the one before it. Instead, the taper
    // is a separate, explicitly-built Bezier appended after: its first
    // control point sits level with the last real point (keeps the approach
    // flat, matching the actual data), its second pulls down near baseline,
    // so only the final stretch past the real data visibly dives.
    const extendRight = points.length > 0 && points[points.length - 1].prob > 0;
    const baselineY = chartHeight - padBottom;
    const curveSegs = catmullRomSegments(points);

    const topSegs = [];
    if (extendLeft) {
      topSegs.push(`M0,${points[0].y.toFixed(1)}`);
      topSegs.push(`L${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`);
      topSegs.push(...curveSegs.slice(1));
    } else {
      topSegs.push(...curveSegs);
    }
    if (extendRight) {
      const lastPt = points[points.length - 1];
      const cp1x = lastPt.x + (width - lastPt.x) * 0.5;
      const cp2x = lastPt.x + (width - lastPt.x) * 0.85;
      topSegs.push(`C${cp1x.toFixed(1)},${lastPt.y.toFixed(1)} ${cp2x.toFixed(1)},${baselineY.toFixed(1)} ${width.toFixed(1)},${baselineY.toFixed(1)}`);
    }

    const areaStartX = extendLeft ? 0 : (points.length ? points[0].x : 0);
    const areaEndX = extendRight ? width : (points.length ? points[points.length - 1].x : 0);

    const linePath = topSegs.join(' ');
    const areaPath = topSegs.length
      ? `M${areaStartX.toFixed(1)},${chartHeight} ` +
        topSegs.join(' ').replace(/^M/, 'L') +
        ` L${areaEndX.toFixed(1)},${chartHeight} Z`
      : '';

    const dots = points
      .map(p => `<circle class="hourly-graph-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2"></circle>`)
      .join('');

    const probCols = hourlyData.map(h => `
            <div class="hourly-graph-col" style="width:${colWidth}px;"><div class="hourly-prob">${escapeHtml(h.prob)}%</div></div>`).join('');
    const mmCols = hourlyData.map(h => `
            <div class="hourly-graph-col" style="width:${colWidth}px;"><div class="hourly-mm">${escapeHtml(h.mm)}mm</div></div>`).join('');
    const timeCols = hourlyData.map(h => `
            <div class="hourly-graph-col" style="width:${colWidth}px;"><div class="hourly-time">${escapeHtml(h.time)}</div></div>`).join('');

    // Today's data genuinely ends at 11pm with nothing further to show here -
    // Tomorrow's row is where the rest lives. Rendered as a sibling outside
    // .hourly-graph-content (the wide, horizontally-scrolled element) so it
    // stays visible at whatever scroll position the user left the graph at,
    // rather than scrolling off with the hourly columns above it.
    const moreDataNote = (dayKey === 'today' && extendRight)
      ? `<div class="hourly-graph-more-note">See Tmow for further data</div>`
      : '';

    return `
      <div class="hourly-graph-scroll" data-day-key="${dayKey}">
        <div class="hourly-graph-content" style="width:${width}px;">
          <svg class="hourly-graph-svg" width="${width}" height="${chartHeight}" viewBox="0 0 ${width} ${chartHeight}" preserveAspectRatio="none">
            <path class="hourly-graph-area" d="${areaPath}"></path>
            <path class="hourly-graph-line" d="${linePath}"></path>
            ${dots}
          </svg>
          <div class="hourly-graph-row">${probCols}</div>
          <div class="hourly-graph-row">${mmCols}</div>
          <div class="hourly-graph-row">${timeCols}</div>
        </div>
      </div>
      ${moreDataNote}`;
  }

  _handleBox3Click() {
    if (this._clickTimer !== null) {
      // second click within the window - reset to auto instead of cycling
      clearTimeout(this._clickTimer);
      this._clickTimer = null;
      this._hass.callService('script', 'dash4_box3_reset_to_auto');
    } else {
      this._clickTimer = setTimeout(() => {
        this._clickTimer = null;
        this._hass.callService('script', 'dash4_box3_tap');
      }, 260);
    }
  }

  // Tapping the row header while its own panel is already expanded mirrors
  // whatever tapping the panel's own content does - users naturally tap the
  // row itself expecting the same cycle/close behavior, not a dead spot.
  // Graph view: single/double-tap disambiguation (cycle to raw / collapse).
  // Raw view: single tap collapses, matching the raw grid's own tap target.
  _handleForecastRowClick(dayKey) {
    if (this._expandedDay === dayKey) {
      if (this._viewMode === 'raw') {
        this._collapseExpanded();
      } else {
        this._handleGraphTap();
      }
      return;
    }
    // Clear any pending single/double-tap disambiguation timer from the
    // previously-expanded day's graph - otherwise it fires ~260ms later
    // against the *newly* expanded day and incorrectly flips it into raw
    // view with no tap on its graph at all.
    if (this._graphTapTimer) {
      clearTimeout(this._graphTapTimer);
      this._graphTapTimer = null;
    }
    this._expandedDay = dayKey;
    this._viewMode = 'graph';
    this._centeringDone = false;
    this._startExpandTimer();
    this._render();
  }

  // (Re)starts the single 3-minute auto-collapse timer for the currently
  // expanded row. Called on fresh expand and on every graph scroll event
  // (resets the countdown so active swiping is never cut off mid-interaction).
  // Deliberately NOT restarted on switching graph->raw view - the timer
  // keeps counting down across that transition and can still fire while raw
  // view is showing, per the design spec's Auto-collapse timer section.
  _startExpandTimer() {
    if (this._expandTimer) clearTimeout(this._expandTimer);
    this._expandTimer = setTimeout(() => {
      this._expandTimer = null;
      if (this._graphTapTimer) {
        clearTimeout(this._graphTapTimer);
        this._graphTapTimer = null;
      }
      this._expandedDay = null;
      this._render();
    }, 180000);
  }

  // Collapses whichever row is expanded, clearing its auto-collapse timer
  // and any pending single/double-tap disambiguation timer.
  _collapseExpanded() {
    if (this._expandTimer) {
      clearTimeout(this._expandTimer);
      this._expandTimer = null;
    }
    if (this._graphTapTimer) {
      clearTimeout(this._graphTapTimer);
      this._graphTapTimer = null;
    }
    this._expandedDay = null;
    this._render();
  }

  // Single/double-tap disambiguation on the graph itself, using the same
  // wait-and-see timer pattern as _handleBox3Click: a second tap arriving
  // within the window cancels the pending single-tap action and fires the
  // double-tap action instead.
  _handleGraphTap() {
    if (this._graphTapTimer !== null) {
      clearTimeout(this._graphTapTimer);
      this._graphTapTimer = null;
      // double tap -> collapse directly, skipping raw view
      this._collapseExpanded();
    } else {
      this._graphTapTimer = setTimeout(() => {
        this._graphTapTimer = null;
        // single tap -> switch to raw view (does not collapse, timer keeps running)
        this._viewMode = 'raw';
        this._render();
      }, 260);
    }
  }
}

customElements.define('dash4-weather-card', Dash4WeatherCard);
