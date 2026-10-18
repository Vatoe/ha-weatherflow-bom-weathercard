#!/usr/bin/env python3
"""One-off backfill: compute the 1991-2020 monthly climatology baseline for
the DASH-4 Climate Drivers STR (Subtropical Ridge) driver.

Not part of the daily/weekly/monthly climate_drivers_scan schedule - run once
(or re-run manually if NOAA revises the reanalysis) to produce
/config/data/climate-drivers/str_climatology_baseline.json, which
scripts/climate_drivers.py's fetch_str() reads every run to compute the
STR-I anomaly. Mirrors fetch_str()'s own fetch/parse logic exactly (same
OPeNDAP box, same profile-max statistic) so the baseline is directly
comparable to what fetch_str() computes for the current month.

~360 sequential OPeNDAP fetches (30 years x 12 months) against NOAA PSL's
THREDDS server - expect this to take several minutes. Small delay between
requests to avoid hammering a shared government data source.
"""
import json
import re
import ssl
import time
import urllib.request

STR_CLIM_FILE = "/config/data/climate-drivers/str_climatology_baseline.json"
STR_ENDPOINT = (
    "https://psl.noaa.gov/thredds/dodsC/"
    "Datasets/ncep.reanalysis.derived/surface/slp.mon.mean.nc"
)
CLIMATOLOGY_YEARS = range(1991, 2021)  # 1991-2020 inclusive, WMO standard normal period
REQUEST_DELAY_S = 0.3

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


def _fetch_text(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX)
    data = resp.read().decode("utf-8", errors="replace")
    resp.close()
    return data


def _profile_max(year, month):
    """Same box/parse/statistic as climate_drivers.py's fetch_str()."""
    t_index = (year - 1948) * 12 + (month - 1)
    url = f"{STR_ENDPOINT}.ascii?slp[{t_index}][40:53][58:60]"
    text = _fetch_text(url)

    rows = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"\[(\d+)\]\[(\d+)\],\s*(.*)", line)  # see climate_drivers.py's matching fix
        if not m:
            continue
        vals = [float(v.strip()) for v in m.group(3).split(",") if v.strip()]
        if len(vals) == 3:
            rows.append(vals)

    if len(rows) < 14:
        raise ValueError(f"Expected 14 lat rows, got {len(rows)}")

    profile = [sum(r) / len(r) for r in rows]
    return max(profile)


def main():
    baseline = {}
    for month in range(1, 13):
        values = []
        for year in CLIMATOLOGY_YEARS:
            try:
                values.append(_profile_max(year, month))
            except Exception as exc:
                print(f"[STR backfill] {year}-{month:02d} failed: {exc}")
            time.sleep(REQUEST_DELAY_S)
        if not values:
            print(f"[STR backfill] Month {month}: NO data collected, skipping")
            continue
        baseline[str(month)] = sum(values) / len(values)
        print(f"[STR backfill] Month {month}: {len(values)}/{len(CLIMATOLOGY_YEARS)} years, mean={baseline[str(month)]:.2f} hPa")

    if len(baseline) < 12:
        raise RuntimeError(f"Only {len(baseline)}/12 months collected - not writing an incomplete baseline")

    with open(STR_CLIM_FILE, "w") as f:
        json.dump(baseline, f, indent=2)
    print(f"[STR backfill] Wrote {STR_CLIM_FILE}")


if __name__ == "__main__":
    main()
