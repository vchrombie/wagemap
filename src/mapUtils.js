export const HOURS_PER_YEAR = 2080;

export const USA_BOUNDS = [
  [-125, 24],
  [-66, 50],
];

export const LEVEL_KEYS = ["I", "II", "III", "IV"];
export const LEVEL_COLORS = {
  1: "#FEF3C7",
  2: "#F59E0B",
  3: "#8B5CF6",
  4: "#4C1D95",
};

export const formatCurrency = (n) =>
  n || n === 0 ? n.toLocaleString("en-US") : "";

export const parseCurrency = (s) => Number(String(s).replace(/,/g, ""));

export const formatAnnualToK = (value) => {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value / 1000);
  return `$${rounded.toLocaleString("en-US")}K`;
};

// Must match your preprocessing normalization
export const normalize = (s) =>
  s.toLowerCase().replace(" county", "").replace(/\s+/g, " ").trim();

export function walkCoords(coords, cb) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number") {
    cb(coords);
  } else {
    coords.forEach((c) => walkCoords(c, cb));
  }
}

export function getBoundsFromGeometry(geometry) {
  if (!geometry || !geometry.coordinates) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  walkCoords(geometry.coordinates, ([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  });

  if (!Number.isFinite(minLng)) return null;

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function getFeatureCenter(feature) {
  const bounds = getBoundsFromGeometry(feature?.geometry);
  if (!bounds) return null;

  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

export function mergeBounds(a, b) {
  if (!a) return b;
  if (!b) return a;

  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}
