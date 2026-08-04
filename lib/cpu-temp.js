'use strict';

/**
 * CPU temperature detection — pure parser for Linux's
 * `/sys/class/thermal/thermal_zoneN/{type,temp}` sysfs tree. `temp` files
 * report milli-degrees Celsius; `type` distinguishes CPU package sensors from
 * unrelated ones (Wi-Fi radios, NVMe, ACPI trip points) that share the same
 * thermal_zoneN namespace on most Linux systems. There's no equivalent
 * zero-dependency read on macOS/Windows, so callers there simply have
 * nothing to pass in — this only covers "where the OS exposes it".
 */

const CPU_ZONE_PATTERN = /x86_pkg_temp|cpu[-_]?thermal|coretemp|acpitz/i;

// zones: [{ type: 'x86_pkg_temp', milliC: 54300 }, ...]
function parseThermalZones(zones) {
  if (!Array.isArray(zones)) return null;
  const readings = zones
    .map(z => ({ type: String(z?.type || ''), milliC: Number(z?.milliC) }))
    // Sysfs occasionally reports -1 or absurd disconnected-sensor values —
    // keep only plausible ambient-to-scorching readings (-50°C..150°C).
    .filter(z => Number.isFinite(z.milliC) && z.milliC > -50000 && z.milliC < 150000);
  if (readings.length === 0) return null;

  const cpuReadings = readings.filter(z => CPU_ZONE_PATTERN.test(z.type));
  const pool = cpuReadings.length > 0 ? cpuReadings : readings;
  const avgMilliC = pool.reduce((sum, z) => sum + z.milliC, 0) / pool.length;
  return Math.round(avgMilliC / 100) / 10; // one decimal place, e.g. 54.3
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseThermalZones, CPU_ZONE_PATTERN };
}
