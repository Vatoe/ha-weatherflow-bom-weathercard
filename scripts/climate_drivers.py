#!/usr/bin/env python3
"""Fetch 5 climate drivers for DASH-4 Weather Card's climate-drivers panel.

Sources: NOAA CPC (SOI/ONI), NOAA PSL (IOD/DMI), NOAA CPC (SAM/AAO),
NOAA PSL OPeNDAP (STR), BOM (MJO/RMM), BOM/NOAA (ENSO outlook).
Output: /config/data/climate-drivers/card.json
"""
import html
import json
import os
import re
import ssl
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

def human_error(exc, limit=110):
    return str(exc)[:limit]


def set_hal_script_failure(label, message):
    """Public build: no failure breadcrumb, just log."""
    if message:
        print(f"[{label}] {message}")

AEST = ZoneInfo("Australia/Sydney")
OUTPUT_PATH = "/config/data/climate-drivers/card.json"
LABEL = "Climate Drivers card"

# Allow unverified SSL for government data sources with stale certs
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


def _fetch_text(url, timeout=30):
    """Fetch a URL and return decoded text."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX)
    data = resp.read().decode("utf-8", errors="replace")
    resp.close()
    return data


# ---------------------------------------------------------------------------
# A. SOI / ONI (ENSO)
# ---------------------------------------------------------------------------
def fetch_soi():
    """NOAA CPC ONI — 3-month running mean SST anomaly for Niño 3.4."""
    try:
        text = _fetch_text(
            "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
        )
        lines = [l for l in text.strip().splitlines() if l.strip()]
        if len(lines) < 2:
            raise ValueError("ONI file has no data rows")
        parts = lines[-1].split()
        if len(parts) < 4:
            raise ValueError(f"ONI row too short: {lines[-1]!r}")
        total = float(parts[2])
        anom = float(parts[3])

        # Phase bucketing
        if anom <= -0.5:
            phase = "La Niña"
        elif anom >= 0.5:
            phase = "El Niño"
        else:
            phase = "Neutral"

        # Strength adjective
        abs_anom = abs(anom)
        if abs_anom > 1.5:
            strength = "Strong"
        elif abs_anom > 0.5:
            strength = "Moderate"
        elif abs_anom > 0.2:
            strength = "Weak"
        else:
            strength = "Neutral"

        phase_label = f"{strength} {phase}" if strength != "Neutral" or phase == "Neutral" else phase
        if phase == "Neutral" and strength != "Neutral":
            phase_label = f"Neutral ({strength.lower()})"
        elif phase != "Neutral":
            phase_label = f"{strength} {phase}"

        # Value label with signed total
        sign = "+" if total >= 0 else ""
        value_label = f"SOI {sign}{total}"

        # Gauge: clamp TOTAL to ±30, normalise to 0–100 (50% = neutral)
        gauge_pct = int(max(0, min(100, (total + 30) / 60 * 100)))

        return {
            "phase": phase,
            "value_label": value_label,
            "gauge_pct": gauge_pct,
            "available": True,
            "explanation": (
                "SOI (Southern Oscillation Index) \u2014 measures the air pressure "
                "difference between Tahiti and Darwin. Sustained negative values "
                "indicate El Ni\u00f1o (weaker trade winds, less rain for eastern "
                "Australia), while sustained positive values indicate La Ni\u00f1a "
                "(stronger trade winds, more rain)."
            ),
        }
    except Exception as exc:
        print(f"[SOI] Error: {exc}")
        return {"phase": "\u2014", "value_label": "\u2014", "gauge_pct": 50, "available": False}


# ---------------------------------------------------------------------------
# B. IOD (DMI — Dipole Mode Index)
# ---------------------------------------------------------------------------
def fetch_iod():
    """NOAA PSL — HadISST DMI (Dipole Mode Index)."""
    try:
        text = _fetch_text(
            "https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data"
        )
        lines = [l for l in text.strip().splitlines() if l.strip()]
        if len(lines) < 3:
            raise ValueError("DMI file too short")
        # Skip header line (year range) and find most recent year row
        data_lines = lines[1:]  # skip "1870 2026"
        latest_val = None
        for line in reversed(data_lines):
            parts = line.split()
            if len(parts) < 13:
                continue
            # Scan months right-to-left for first non-missing value
            for val_str in reversed(parts[1:13]):
                try:
                    val = float(val_str)
                    if val != -9999.0:
                        latest_val = val
                        break
                except ValueError:
                    continue
            if latest_val is not None:
                break
        if latest_val is None:
            raise ValueError("No valid IOD value found")

        # Phase
        if latest_val <= -0.4:
            phase = "Negative IOD"
            phase_short = "Negative"
        elif latest_val >= 0.4:
            phase = "Positive IOD"
            phase_short = "Positive"
        else:
            phase = "Neutral"
            phase_short = "Neutral"

        # Unicode minus for display
        display_val = latest_val if latest_val >= 0 else latest_val
        minus = "\u2212" if display_val < 0 else ""
        value_label = f"{minus}{abs(display_val):.2f} \u00b0C"

        # Gauge: clamp to ±2.0°C
        gauge_pct = int(max(0, min(100, (latest_val + 2.0) / 4.0 * 100)))

        return {
            "phase": phase,
            "value_label": value_label,
            "gauge_pct": gauge_pct,
            "available": True,
            "explanation": (
                "IOD (Indian Ocean Dipole) — the difference in sea surface "
                "temperature between the western and eastern tropical Indian "
                "Ocean. A positive IOD (warmer west, cooler east) means less "
                "moisture flows toward Australia, typically bringing drier "
                "conditions. A negative IOD (cooler west, warmer east) pulls "
                "extra moisture from the Indian Ocean, often boosting rainfall "
                "for eastern Australia."
            ),
        }
    except Exception as exc:
        print(f"[IOD] Error: {exc}")
        return {"phase": "—", "value_label": "—", "gauge_pct": 50, "available": False}


# ---------------------------------------------------------------------------
# C. SAM (AAO — Antarctic Oscillation Index)
# ---------------------------------------------------------------------------
def fetch_sam():
    """NOAA CPC — monthly AAO (SAM) index."""
    try:
        text = _fetch_text(
            "https://www.cpc.ncep.noaa.gov/products/precip/CWlink/"
            "daily_ao_index/aao/monthly.aao.index.b79.current.ascii.table"
        )
        lines = [l for l in text.strip().splitlines() if l.strip()]
        if len(lines) < 2:
            raise ValueError("SAM file too short")
        # First line is header: "Jan Feb Mar ... Dec"
        data_lines = lines[1:]
        latest_val = None
        for line in reversed(data_lines):
            parts = line.split()
            if len(parts) < 13:
                continue
            for val_str in reversed(parts[1:13]):
                val_str = val_str.strip()
                if not val_str:
                    continue
                try:
                    latest_val = float(val_str)
                    break
                except ValueError:
                    continue
            if latest_val is not None:
                break
        if latest_val is None:
            raise ValueError("No valid SAM value found")

        phase = "Positive SAM" if latest_val > 0 else "Negative SAM"
        if abs(latest_val) < 0.1:
            phase = "Neutral SAM"

        minus = "\u2212" if latest_val < 0 else ""
        value_label = f"{minus}{abs(latest_val):.1f} index"

        # Gauge: clamp to ±4.0
        gauge_pct = int(max(0, min(100, (latest_val + 4.0) / 8.0 * 100)))

        return {
            "phase": phase,
            "value_label": value_label,
            "gauge_pct": gauge_pct,
            "available": True,
            "explanation": (
                "SAM (Southern Annular Mode) \u2014 describes the north-south "
                "shift of the strong westerly winds surrounding Antarctica. "
                "Positive SAM pushes rain-bearing systems southward (drier for "
                "southern Australia), while negative SAM brings them closer to "
                "the coast (wetter for southeastern Australia)."
            ),
        }
    except Exception as exc:
        print(f"[SAM] Error: {exc}")
        return {"phase": "\u2014", "value_label": "\u2014", "gauge_pct": 50, "available": False}


# ---------------------------------------------------------------------------
# D. STR (Subtropical Ridge) — computed from OPeNDAP SLP
# ---------------------------------------------------------------------------
STR_CLIM_FILE = "/config/data/climate-drivers/str_climatology_baseline.json"
STR_ENDPOINT = (
    "https://psl.noaa.gov/thredds/dodsC/"
    "Datasets/ncep.reanalysis.derived/surface/slp.mon.mean.nc"
)


def _load_str_climatology():
    """Load the 12-month climatology baseline from a JSON file."""
    with open(STR_CLIM_FILE) as f:
        return json.load(f)


def fetch_str():
    """Compute STR position and intensity anomaly from NCEP SLP reanalysis."""
    try:
        clim = _load_str_climatology()
    except Exception as exc:
        print(f"[STR] Climatology baseline not loaded ({STR_CLIM_FILE}): {exc}")
        return {
            "phase": "\u2014",
            "value_label": "\u2014",
            "gauge_pct": 50,
            "available": False,
            "explanation": (
                "STR (Subtropical Ridge) \u2014 a belt of high pressure across "
                "southern Australia. A stronger ridge blocks cold fronts and "
                "rain-bearing systems, bringing drier conditions; a weaker "
                "ridge allows more fronts through."
            ),
        }

    now = datetime.now(AEST)
    t_index = (now.year - 1948) * 12 + (now.month - 1)

    # This reanalysis product lags real-time by several months (confirmed
    # live 2026-08-19: requesting "this month" 400'd with "stop >= size:
    # 943:938" - only 938 months were actually published). Discover the
    # true latest available index via .dds (cheap - dimension sizes only,
    # no data) and clamp to it rather than assuming "now" is published yet.
    try:
        dds = _fetch_text(f"{STR_ENDPOINT}.dds", timeout=30)
        m = re.search(r"time\s*=\s*(\d+)", dds)
        if m:
            latest_available = int(m.group(1)) - 1
            if t_index > latest_available:
                t_index = latest_available
    except Exception as exc:
        print(f"[STR] Could not check dataset size, using calendar month anyway: {exc}")

    # The month actually being fetched (may lag "now" per the clamp above) -
    # this, not now.month, is what the climatology baseline must be compared
    # against for a meaningful anomaly.
    data_month = t_index % 12 + 1

    # Lat: −10° to −42.5°S (indices 40–53), Lon: 145°E–150°E (indices 58–60)
    # OPeNDAP .ascii ranges must be ascending
    url = (
        f"{STR_ENDPOINT}.ascii?"
        f"slp[{t_index}][40:53][58:60]"
    )
    try:
        text = _fetch_text(url, timeout=60)
    except Exception as exc:
        print(f"[STR] OPeNDAP fetch failed: {exc}")
        return {
            "phase": "\u2014",
            "value_label": "\u2014",
            "gauge_pct": 50,
            "available": False,
        }

    try:
        # Parse the OPeNDAP ASCII response
        # Format: "slp[row][col], val1, val2, ..." per line
        rows = []
        for line in text.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            # Each line: "[row][col], val1, val2, val3" - NOT "slp[row][col],
            # ..." (the "slp" prefix only appears once, on the one-time
            # "slp.slp[1][14][3]" dimension-summary line, confirmed live
            # 2026-08-19 by fetching the endpoint directly - the old regex
            # required "slp[" and silently matched 0 rows on every request).
            m = re.match(r"\[(\d+)\]\[(\d+)\],\s*(.*)", line)
            if not m:
                continue
            vals = [float(v.strip()) for v in m.group(3).split(",") if v.strip()]
            if len(vals) == 3:
                rows.append(vals)

        if len(rows) < 14:
            raise ValueError(f"Expected 14 lat rows, got {len(rows)}")

        # Average 3 lon columns per lat row → 1D profile (lat 40=−10°S to 53=−42.5°S)
        profile = [sum(r) / len(r) for r in rows]
        # Find latitude index of max SLP (the ridge line)
        max_idx = max(range(len(profile)), key=lambda i: profile[i])
        max_val = profile[max_idx]

        # Convert index to °S: index 40 = −10°S, each step = −2.5°
        str_p_lat = -(10.0 + max_idx * 2.5)

        # Intensity anomaly - compared against the baseline for the month
        # actually fetched (data_month), which may lag "now" - comparing a
        # lagged reading against the wrong (current) month's baseline would
        # produce a meaningless anomaly.
        month_key = str(data_month)
        baseline = clim.get(month_key)
        if baseline is None:
            raise ValueError(f"No baseline for month {data_month}")
        str_i_anom = max_val - baseline

        # Phase
        if str_p_lat < -32:
            pos = "Southerly"
        elif str_p_lat > -28:
            pos = "Northerly"
        else:
            pos = "Average"

        if str_i_anom > 0.5:
            intensity = "Strong"
        elif str_i_anom < -0.5:
            intensity = "Weak"
        else:
            intensity = "Normal"

        phase = f"{pos} \u00b7 {intensity}"

        minus = "\u2212" if str_i_anom < 0 else ""
        value_label = f"{minus}{abs(str_i_anom):.1f} hPa"

        # Gauge: clamp STR-P to −40..−20°S, normalise to 0–100%
        gauge_pct = int(max(0, min(100, (str_p_lat + 40) / 20 * 100)))

        return {
            "phase": phase,
            "value_label": value_label,
            "gauge_pct": gauge_pct,
            "available": True,
            "explanation": (
                "STR (Subtropical Ridge) \u2014 a belt of high pressure across "
                "southern Australia. A stronger ridge blocks cold fronts and "
                "rain-bearing systems, bringing drier conditions; a weaker "
                "ridge allows more fronts through."
            ),
        }
    except Exception as exc:
        print(f"[STR] Parse/compute failed: {exc}")
        return {
            "phase": "\u2014",
            "value_label": "\u2014",
            "gauge_pct": 50,
            "available": False,
        }


# ---------------------------------------------------------------------------
# E. MJO (RMM — Real-time Multivariate MJO index)
# ---------------------------------------------------------------------------
def fetch_mjo():
    """BOM — RMM phase and amplitude."""
    try:
        text = _fetch_text(
            "http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt",
            timeout=20,
        )
        lines = [l for l in text.strip().splitlines() if l.strip() and not l.startswith("#")]
        if len(lines) < 2:
            raise ValueError("MJO file has no data rows")
        # Last non-comment, non-empty line
        parts = lines[-1].split()
        if len(parts) < 7:
            raise ValueError(f"MJO row too short: {lines[-1]!r}")
        # Columns: year month day RMM1 RMM2 phase amplitude [flag]
        # (confirmed live 2026-08-19: the 6-column "no day" assumption put a
        # RMM2 float, e.g. '0.12845999', in the phase slot - int() blew up)
        phase_num = int(parts[5])
        amplitude = float(parts[6])

        if amplitude > 1.0:
            amp_label = "strong"
        elif amplitude > 0.5:
            amp_label = "moderate"
        else:
            amp_label = "weak"

        # Phase wheel region is complex; just report amplitude bucket
        amplitude_label = amp_label

        return {
            "phase_num": phase_num,
            "phase_label": f"Phase {phase_num}",
            "amplitude_label": amplitude_label,
            "available": True,
            "explanation": (
                "MJO (Madden-Julian Oscillation) \u2014 an eastward-moving pulse "
                "of cloud and rain near the equator that cycles every 30\u201360 "
                "days. Different phases bring different rainfall patterns to "
                "Australia, with phases 4\u20136 typically enhancing rainfall in "
                "the east."
            ),
        }
    except Exception as exc:
        print(f"[MJO] Error: {exc}")
        return {
            "phase_num": 0,
            "phase_label": "\u2014",
            "amplitude_label": "\u2014",
            "available": False,
        }


# ---------------------------------------------------------------------------
# F. Outlook probability (ENSO outlook)
# ---------------------------------------------------------------------------
def fetch_outlook():
    """NOAA CPC ENSO Discussion — scrape the "In summary" paragraph only.

    Previously scraped BOM's general climate/enso/ education page and took
    the FIRST percentage found anywhere in the whole page - that page has no
    actual outlook probability on it at all, so it was grabbing unrelated
    numbers from background explainer prose (e.g. "around 70% of monthly
    Nino3 values..."), and the headline was similarly random surrounding
    text, not a real outlook statement (confirmed live 2026-08-19 - the
    card was showing a mid-sentence fragment of that explainer prose).
    CPC's ENSO Discussion always ends with a single, clearly-delimited
    "In summary, ..." paragraph that IS the real synthesized outlook -
    scoping the percentage/headline extraction to just that paragraph
    matches spec's "narrow, specific parser" requirement (never guess from
    the whole page).
    """
    try:
        text = _fetch_text(
            "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/"
            "enso_advisory/ensodisc.shtml",
            timeout=20,
        )
        m = re.search(r"In summary,\s*(.+?)</p>", text, re.IGNORECASE | re.DOTALL)
        if not m:
            raise ValueError("No 'In summary' paragraph found")

        clean = re.sub(r"<[^>]+>", " ", m.group(1))
        clean = html.unescape(clean)
        clean = re.sub(r"\s+", " ", clean).strip()

        pct = 0
        pct_available = False
        pct_match = re.search(r"(\d{1,3})\s*%", clean)
        if pct_match:
            candidate = int(pct_match.group(1))
            if 0 < candidate <= 100:
                pct = candidate
                pct_available = True

        # Short headline: the summary's first clause, up to the first comma/period.
        headline_match = re.match(r"([^,.]+)", clean)
        headline = headline_match.group(1).strip() if headline_match else clean[:80]

        # Localize the full paragraph for the Southern Hemisphere. NOAA writes
        # for the Northern Hemisphere ("fall and winter") — the same event runs
        # through Australia's spring/summer, so render for that audience instead.
        local_text = re.sub(
            r" during the Northern Hemisphere fall and winter",
            " through Australia's spring and summer",
            clean,
            flags=re.IGNORECASE,
        )

        return {
            "headline": headline,
            "pct": pct,
            "pct_available": pct_available,
            "text": local_text,
        }
    except Exception as exc:
        print(f"[Outlook] Error: {exc}")
        return {
            "headline": "Seasonal outlook unavailable",
            "pct": 0,
            "pct_available": False,
        }


# ---------------------------------------------------------------------------
# Summary text generation
# ---------------------------------------------------------------------------
def build_summary_text(soi, iod, sam, str_data, outlook=None):
    """Rule-based synthesis over the 5 driver readings, written for the
    Australian east coast. Condition + evidence + east-coast impact.

    Unlike the old SOI-first builder, this starts from the overall ENSO
    condition (from the NOAA outlook when available, else the SOI phase),
    then stitches the supporting drivers (IOD/SAM) as evidence, then notes
    the STR caveat only when it actually qualifies (Northerly + Strong).
    """
    def _cap(s):
        return s[0].upper() + s[1:] if s else s

    # 1. Condition — prefer the formal NOAA outlook, fall back to SOI phase.
    condition = None
    if outlook and outlook.get("headline"):
        hl = outlook["headline"].lower()
        if "el ni" in hl:
            condition = "El Niño"
        elif "la ni" in hl:
            condition = "La Niña"
    if condition is None and soi.get("available"):
        ph = soi["phase"].lower()
        if "niño" in ph:
            condition = "El Niño"
        elif "niña" in ph:
            condition = "La Niña"
    if condition is None:
        condition = "Neutral"

    impact_by = {
        "El Niño": "typically drier and warmer weather for the east coast",
        "La Niña": "typically wetter and cooler weather for the east coast",
        "Neutral": "no strong seasonal steer for the east coast either way",
    }
    impact = impact_by[condition]

    if condition == "Neutral":
        sentence1 = (
            "Seasonal indicators are mostly neutral, with no strong steer "
            "for the east coast either way."
        )
    else:
        sentence1 = f"{condition} conditions are in place, {impact}."

    # 2. Evidence — supporting drivers that reinforce or offset the condition.
    signals = []
    if soi.get("available"):
        ph = soi["phase"].lower()
        if "niño" in ph:
            signals.append("the SOI is firmly in El Niño territory")
        elif "niña" in ph:
            signals.append("the SOI has climbed into La Niña territory")
        else:
            signals.append("the SOI is neutral")
    if iod.get("available"):
        if "negative" in iod["phase"]:
            signals.append("a negative IOD is bringing extra moisture from the Indian Ocean")
        elif "positive" in iod["phase"]:
            signals.append("a positive IOD is suppressing moisture from the Indian Ocean")
        else:
            signals.append("the IOD is neutral")
    if sam.get("available"):
        if sam["phase"].startswith("Positive"):
            signals.append("a positive SAM is pushing rain-bearing systems further south")
        elif sam["phase"].startswith("Negative"):
            signals.append("a negative SAM is keeping rain-bearing systems closer to the coast")

    if signals:
        if len(signals) == 1:
            evidence = f"The driver: {signals[0]}."
        else:
            joined = ", ".join(signals[:-1]) + " and " + signals[-1]
            evidence = f"The drivers: {joined}."
    else:
        evidence = ""

    # 3. STR caveat — only when it genuinely tempers the signal.
    if (
        str_data.get("available")
        and "Northerly" in str_data.get("phase", "")
        and "Strong" in str_data.get("phase", "")
    ):
        evidence += (
            " A stronger, more northerly Subtropical Ridge may partly block"
            " rain-bearing systems from reaching the coast, tempering how much"
            " of that signal actually lands here."
        )

    parts = [sentence1]
    if evidence:
        parts.append(_cap(evidence))
    return " ".join(parts) if parts else "No climate driver data available."


# ---------------------------------------------------------------------------
# Change detection (spec §5)
# ---------------------------------------------------------------------------
def compute_change_detection(data, previous):
    """Compare new data against previous output; carry forward last_changed if unchanged."""
    now_ts = datetime.now(AEST).strftime("%Y-%m-%dT%H:%M:%S")
    data["generated_at"] = now_ts

    if previous is None:
        data["last_changed"] = now_ts
        return

    # Build comparable dicts (without timestamps)
    new_compare = {
        "outlook": data.get("outlook"),
        "summary_text": data.get("summary_text"),
        "drivers": data.get("drivers"),
    }
    old_compare = {
        "outlook": previous.get("outlook"),
        "summary_text": previous.get("summary_text"),
        "drivers": previous.get("drivers"),
    }

    if new_compare == old_compare:
        data["last_changed"] = previous.get("last_changed", now_ts)
    else:
        data["last_changed"] = now_ts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    previous = None
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH) as f:
                previous = json.load(f)
        except Exception:
            previous = None

    soi = fetch_soi()
    iod = fetch_iod()
    sam = fetch_sam()
    str_data = fetch_str()
    mjo = fetch_mjo()
    outlook = fetch_outlook()

    summary_text = build_summary_text(soi, iod, sam, str_data, outlook=outlook)

    data = {
        "generated_at": "",
        "last_changed": "",
        "outlook": outlook,
        "summary_text": summary_text,
        "drivers": {
            "soi": soi,
            "iod": iod,
            "sam": sam,
            "str": str_data,
            "mjo": mjo,
        },
    }

    compute_change_detection(data, previous)

    # Atomic write
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    tmp = OUTPUT_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, OUTPUT_PATH)


    # Clear the failure breadcrumb on success
    set_hal_script_failure(LABEL, "")
    print(f"[{LABEL}] Done — {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        set_hal_script_failure(LABEL, f"{LABEL} failed: {human_error(exc)}")
        raise
