import os, requests

with open(".env", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

H = {"X-Auth-Token": os.environ["FOOTBALLDATA_KEY"]}
r = requests.get("https://api.football-data.org/v4/competitions/PD/standings",
                 headers=H, params={"season": 2025}, timeout=30)
r.raise_for_status()
for row in r.json()["standings"][0]["table"]:
    print(f'{row["position"]:>2} {row["team"]["name"]:<28} {row["points"]:>3} {row["goalDifference"]:>4}')