import os
import time
import requests

for line in open(".env", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

H = {"X-Auth-Token": os.environ["FOOTBALLDATA_KEY"]}

for comp in ("PD", "SA", "CL"):
    for season in (2023, 2024, 2025, 2026):
        r = requests.get(
            f"https://api.football-data.org/v4/competitions/{comp}/matches",
            headers=H,
            params={"season": season},
            timeout=30,
        )
        n = len(r.json().get("matches", []))
        print(comp, season, r.status_code, n)
        time.sleep(7)  # free tier allows 10 requests/minute