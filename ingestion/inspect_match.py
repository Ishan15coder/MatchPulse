import os
import json
import requests

with open(".env", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

H = {"X-Auth-Token": os.environ["FOOTBALLDATA_KEY"]}

r = requests.get(
    "https://api.football-data.org/v4/competitions/PD/matches",
    headers=H,
    params={"season": 2025},
    timeout=30,
)
r.raise_for_status()
data = r.json()

print(json.dumps(data["matches"][0], indent=2))