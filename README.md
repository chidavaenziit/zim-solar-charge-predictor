# Zimbabwe Solar Charge Predictor

A static web app that predicts how much a solar panel system will charge a battery bank on any given day (and up to 7 days ahead) at any location in Zimbabwe.

## How it works

1. **Location** - pick a Zimbabwean town/city from the dropdown, or enter custom latitude/longitude.
2. **Solar radiation data** - the app calls the free [Open-Meteo](https://open-meteo.com) API, requesting Global Tilted Irradiance (GTI) matched to your panel's tilt and azimuth (compass direction).
3. **Energy yield calculation** - converts irradiance (kWh/m2) into predicted energy output (kWh) using your panel wattage, panel count, and a system loss factor (wiring, inverter, dust, temperature derating).
4. **Battery simulation** - models charging into your battery bank based on the chemistry you select:
   - **Lithium-ion (LiFePO4)**: ~97% round-trip efficiency, 90% usable depth of discharge
   - **Gel (sealed lead-acid)**: ~85% efficiency, 60% usable DoD
   - **Flooded lead-acid**: ~82% efficiency, 50% usable DoD
5. **Charts** - daily energy yield, projected battery state of charge, and daily irradiance, rendered with Chart.js.

## Running locally

This is a fully static site - no build step, no server required.

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deployment (GitHub Pages)

1. Push this repository to GitHub.
2. Go to **Settings -> Pages**.
3. Under "Build and deployment", choose **Deploy from a branch**, select `main` and `/ (root)`.
4. Save - your site will be live at `https://<username>.github.io/<repo-name>/` within a minute.

## Notes and limitations

- Predictions are estimates. Real-world output depends on shading, panel soiling, temperature, cloud cover accuracy, cable losses, and equipment condition.
- Forecast horizon is limited to 7 days (adjustable in `app.js` via the `forecast_days` parameter, up to 16 days supported by Open-Meteo).
- Open-Meteo's free tier is for non-commercial use with no API key required.

## Tech stack

- Vanilla HTML/CSS/JavaScript (no framework, no build tools)
- [Chart.js](https://www.chartjs.org/) via CDN for visualizations
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) for solar radiation data
