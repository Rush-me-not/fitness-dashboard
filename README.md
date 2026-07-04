# Fitness Dashboard — Hermes Coach

Interactive fitness dashboard hosted on GitHub Pages. Visualizes data from the three-engine Hermes Fitness Coach system.

## Quick Start

```bash
# 1. Export data from fitness.db
python ~/fitness/scripts/export_dashboard_data_v2.py --output ./dashboard-data/

# 2. Open in browser
open index.html
```

## Deployment (GitHub Pages)

```bash
git add -A && git commit -m "Update dashboard data"
git push origin main
```

GitHub Pages auto-deploys from `main` branch root.

## Sections

- **Overview** — KPIs, weekly volume, quality trend
- **History** — All workouts with expandable exercise detail
- **Progression** — Per-exercise weight progression charts
- **Muscles** — Muscle group volume distribution + balance
- **Insights** — Coaching Engine session quality scores
- **Decisions** — Decision Engine recommendation log with success rates
- **Health** — System integrity checks (data completeness, schema, activity)

## Data

All data is exported from the live `fitness.db` by `export_dashboard_data_v2.py`. No backend server required — this is a purely static site.
