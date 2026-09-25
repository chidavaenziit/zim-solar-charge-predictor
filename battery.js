
// Battery chemistry profiles based on typical published round-trip
// efficiency and usable depth-of-discharge figures.
const BATTERY_PROFILES = {
  lithium: {
    label: "Lithium-ion (LiFePO4)",
    roundTripEfficiency: 0.97,
    usableDoD: 0.90,
    chargeEfficiency: 0.98
  },
  gel: {
    label: "Gel (sealed lead-acid)",
    roundTripEfficiency: 0.85,
    usableDoD: 0.60,
    chargeEfficiency: 0.88
  },
  "lead-acid": {
    label: "Flooded lead-acid",
    roundTripEfficiency: 0.82,
    usableDoD: 0.50,
    chargeEfficiency: 0.85
  }
};

function getBatteryProfile(type) {
  return BATTERY_PROFILES[type] || BATTERY_PROFILES["lead-acid"];
}

function simulateBatteryCharging(dailyEnergyKwh, batteryType, capacityAh, voltage, startSocPercent) {
  const profile = getBatteryProfile(batteryType);
  const capacityKwh = (capacityAh * voltage) / 1000;
  const minSocFraction = 1 - profile.usableDoD;

  let socKwh = capacityKwh * (startSocPercent / 100);

  const socSeries = [];
  const chargeAddedAhSeries = [];
  const cappedEnergySeries = [];

  for (const rawEnergy of dailyEnergyKwh) {
    const usableEnergy = rawEnergy * profile.chargeEfficiency;
    const ceilingKwh = capacityKwh;
    const energyBeforeCap = socKwh + usableEnergy;
    const actualStoredKwh = Math.min(energyBeforeCap, ceilingKwh);
    const energyActuallyAdded = actualStoredKwh - socKwh;

    socKwh = actualStoredKwh;

    const socPercent = (socKwh / capacityKwh) * 100;
    const chargeAddedAh = (energyActuallyAdded * 1000) / voltage;

    socSeries.push(Number(socPercent.toFixed(1)));
    chargeAddedAhSeries.push(Number(chargeAddedAh.toFixed(1)));
    cappedEnergySeries.push(Number(energyActuallyAdded.toFixed(2)));
  }

  return { socSeries, chargeAddedAhSeries, cappedEnergySeries, capacityKwh, minSocFraction };
}
