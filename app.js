
const locationSelect = document.getElementById("location-select");
const latInput = document.getElementById("lat-input");
const lonInput = document.getElementById("lon-input");
const useCoordsBtn = document.getElementById("use-coords-btn");
const predictBtn = document.getElementById("predict-btn");
const errorMsg = document.getElementById("error-msg");
const resultsCard = document.getElementById("results-card");
const todaySummary = document.getElementById("today-summary");
const dailyTableBody = document.querySelector("#daily-table tbody");

let selectedLocation = ZIM_LOCATIONS[0];
let energyChart, socChart, irradianceChart;

function populateLocationDropdown() {
  ZIM_LOCATIONS.forEach((loc, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = loc.name;
    locationSelect.appendChild(opt);
  });
}

locationSelect.addEventListener("change", () => {
  selectedLocation = ZIM_LOCATIONS[Number(locationSelect.value)];
  latInput.value = "";
  lonInput.value = "";
});

useCoordsBtn.addEventListener("click", () => {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    showError("Enter valid latitude and longitude values.");
    return;
  }
  selectedLocation = { name: `Custom (${lat.toFixed(3)}, ${lon.toFixed(3)})`, lat, lon };
  clearError();
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}
function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = "";
}

function buildOpenMeteoUrl(lat, lon, tilt, azimuth) {
  const compassToOpenMeteo = (compassDeg) => {
    let om = compassDeg - 180;
    if (om > 180) om -= 360;
    if (om < -180) om += 360;
    return om;
  };
  const omAzimuth = compassToOpenMeteo(azimuth);

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: "shortwave_radiation_sum",
    hourly: "global_tilted_irradiance",
    tilt: String(tilt),
    azimuth: String(omAzimuth),
    forecast_days: "7",
    timezone: "Africa/Harare"
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

async function fetchSolarForecast(lat, lon, tilt, azimuth) {
  const url = buildOpenMeteoUrl(lat, lon, tilt, azimuth);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather API returned status ${res.status}`);
  }
  return res.json();
}

function aggregateHourlyGtiToDailyKwh(hourlyTimes, hourlyGti) {
  const dailyMap = {};
  hourlyTimes.forEach((t, i) => {
    const date = t.slice(0, 10);
    const val = hourlyGti[i] || 0;
    dailyMap[date] = (dailyMap[date] || 0) + val;
  });
  const dates = Object.keys(dailyMap).sort();
  const dailyKwhM2 = dates.map((d) => dailyMap[d] / 1000);
  return { dates, dailyKwhM2 };
}

function computeEnergyYieldKwh(dailyIrradianceKwhM2, panelWatt, panelCount, systemLossesPercent) {
  const totalRatedKw = (panelWatt * panelCount) / 1000;
  const lossFactor = 1 - systemLossesPercent / 100;
  return dailyIrradianceKwhM2.map((irr) => Number((irr * totalRatedKw * lossFactor).toFixed(2)));
}

function renderCharts(dates, irradianceSeries, energySeries, socSeries) {
  const labels = dates.map((d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  });

  const commonOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: "#e2e8f0" } } },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } }
    }
  };

  if (energyChart) energyChart.destroy();
  if (socChart) socChart.destroy();
  if (irradianceChart) irradianceChart.destroy();

  energyChart = new Chart(document.getElementById("energyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Energy yield (kWh)",
        data: energySeries,
        backgroundColor: "#f59e0b"
      }]
    },
    options: commonOptions
  });

  socChart = new Chart(document.getElementById("socChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Battery SOC (%)",
        data: socSeries,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      ...commonOptions,
      scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, max: 100 } }
    }
  });

  irradianceChart = new Chart(document.getElementById("irradianceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Irradiance on panel (kWh/m2)",
        data: irradianceSeries,
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56,189,248,0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: commonOptions
  });
}

function renderSummary(dates, energySeries, socSeries, batteryLabel) {
  const todayEnergy = energySeries[0];
  const todaySoc = socSeries[0];
  const totalWeekEnergy = energySeries.reduce((a, b) => a + b, 0);

  todaySummary.innerHTML = `
    <div class="summary-item">
      <div class="value">${todayEnergy.toFixed(2)} kWh</div>
      <div class="label">Predicted yield today</div>
    </div>
    <div class="summary-item">
      <div class="value">${todaySoc.toFixed(0)}%</div>
      <div class="label">Battery SOC end of today (${batteryLabel})</div>
    </div>
    <div class="summary-item">
      <div class="value">${totalWeekEnergy.toFixed(1)} kWh</div>
      <div class="label">Total predicted yield (7 days)</div>
    </div>
  `;
}

function renderTable(dates, irradianceSeries, energySeries, chargeAddedAhSeries, socSeries) {
  dailyTableBody.innerHTML = "";
  dates.forEach((d, i) => {
    const tr = document.createElement("tr");
    const dateLabel = new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    tr.innerHTML = `
      <td>${dateLabel}</td>
      <td>${irradianceSeries[i].toFixed(2)}</td>
      <td>${energySeries[i].toFixed(2)}</td>
      <td>${chargeAddedAhSeries[i].toFixed(1)}</td>
      <td>${socSeries[i].toFixed(0)}%</td>
    `;
    dailyTableBody.appendChild(tr);
  });
}

async function runPrediction() {
  clearError();
  predictBtn.disabled = true;
  predictBtn.textContent = "Fetching forecast...";

  try {
    const panelWatt = parseFloat(document.getElementById("panel-watt").value);
    const panelCount = parseInt(document.getElementById("panel-count").value, 10);
    const tilt = parseFloat(document.getElementById("panel-tilt").value);
    const azimuth = parseFloat(document.getElementById("panel-azimuth").value);
    const systemLosses = parseFloat(document.getElementById("system-losses").value);
    const batteryType = document.getElementById("battery-type").value;
    const capacityAh = parseFloat(document.getElementById("battery-capacity").value);
    const voltage = parseFloat(document.getElementById("battery-voltage").value);
    const startSoc = parseFloat(document.getElementById("current-soc").value);

    if ([panelWatt, panelCount, tilt, azimuth, systemLosses, capacityAh, voltage, startSoc].some(Number.isNaN)) {
      throw new Error("Please fill in all numeric fields with valid numbers.");
    }

    const data = await fetchSolarForecast(selectedLocation.lat, selectedLocation.lon, tilt, azimuth);

    const hourlyTimes = data.hourly.time;
    const hourlyGti = data.hourly.global_tilted_irradiance;
    const { dates, dailyKwhM2 } = aggregateHourlyGtiToDailyKwh(hourlyTimes, hourlyGti);

    const energySeries = computeEnergyYieldKwh(dailyKwhM2, panelWatt, panelCount, systemLosses);
    const { socSeries, chargeAddedAhSeries } = simulateBatteryCharging(
      energySeries, batteryType, capacityAh, voltage, startSoc
    );

    const batteryLabel = getBatteryProfile(batteryType).label;

    resultsCard.hidden = false;
    renderSummary(dates, energySeries, socSeries, batteryLabel);
    renderCharts(dates, dailyKwhM2, energySeries, socSeries);
    renderTable(dates, dailyKwhM2, energySeries, chargeAddedAhSeries, socSeries);

    resultsCard.scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong fetching the forecast. Please try again.");
  } finally {
    predictBtn.disabled = false;
    predictBtn.textContent = "Predict charging";
  }
}

predictBtn.addEventListener("click", runPrediction);

populateLocationDropdown();
