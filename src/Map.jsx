import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import { STATE_FP_TO_ABBR } from "./stateFpToAbbr";
import SocAutocomplete from "./SocAutocomplete";

import "./Map.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// ---------------- CONSTANTS ----------------
const HOURS_PER_YEAR = 2080;

const USA_BOUNDS = [
  [-125, 24],
  [-66, 50],
];

const formatCurrency = (n) => (n || n === 0 ? n.toLocaleString("en-US") : "");
const parseCurrency = (s) => Number(String(s).replace(/,/g, ""));
const formatAnnualToK = (value) => {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value / 1000);
  return `$${rounded.toLocaleString("en-US")}K`;
};

// Must match your preprocessing normalization
const normalize = (s) =>
  s.toLowerCase().replace(" county", "").replace(/\s+/g, " ").trim();

const LEVEL_KEYS = ["I", "II", "III", "IV"];
const LEVEL_COLORS = {
  1: "#FEF3C7",
  2: "#F59E0B",
  3: "#8B5CF6",
  4: "#4C1D95",
};

function walkCoords(coords, cb) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number") {
    cb(coords);
  } else {
    coords.forEach((c) => walkCoords(c, cb));
  }
}

function getBoundsFromGeometry(geometry) {
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

function getFeatureCenter(feature) {
  const bounds = getBoundsFromGeometry(feature?.geometry);
  if (!bounds) return null;

  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

function mergeBounds(a, b) {
  if (!a) return b;
  if (!b) return a;

  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

function LegendItem({ color, label }) {
  return (
    <div className="legend-item">
      <span className="legend-swatch" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

export default function Map() {
  const mapRef = useRef(null);
  const countiesRef = useRef(null);
  const countyFeatureMapRef = useRef({});
  const countiesByStateRef = useRef({});
  const wageTableRef = useRef(null);

  const [collapsed, setCollapsed] = useState(false);
  const [soc, setSoc] = useState("11-1011");
  const [socText, setSocText] = useState("11-1011 – Chief Executives");

  const [salary, setSalary] = useState(150000);
  const [stateOptions, setStateOptions] = useState([]);
  const [countyOptions, setCountyOptions] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");

  function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: "Wagemap",
        text: "Check prevailing wage levels by county",
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    }
  }

  // ---------------- MAP INIT ----------------
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      bounds: USA_BOUNDS,
      fitBoundsOptions: { padding: 20 },
    });

    mapRef.current = map;

    map.on("load", async () => {
      const countyRes = await fetch("/counties.geojson");
      const counties = await countyRes.json();
      countiesRef.current = counties;

      prepareLocationData(counties);

      map.addSource("counties", {
        type: "geojson",
        data: counties,
      });

      map.addLayer({
        id: "county-fill",
        type: "fill",
        source: "counties",
        paint: {
          "fill-color": "#F3F4F6",
          "fill-opacity": 0.8,
        },
      });

      map.addLayer({
        id: "county-outline",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "#9ca3af",
          "line-width": 1,
          "line-opacity": 0.9,
        },
        layout: { "line-join": "round" },
      });

      map.on("click", "county-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;

        showCountyPopup(f, e.lngLat);
      });

      map.on("mouseenter", "county-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "county-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      updateLevels(soc, salary);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prepareLocationData(countiesGeojson) {
    const stateSet = new Set();
    const byState = {};
    const featureMap = {};

    countiesGeojson.features.forEach((f) => {
      const abbr = STATE_FP_TO_ABBR[f.properties.STATEFP];
      if (!abbr) return;

      stateSet.add(abbr);
      featureMap[f.properties.GEOID] = f;

      if (!byState[abbr]) byState[abbr] = [];
      byState[abbr].push({
        name: f.properties.NAME,
        geoid: f.properties.GEOID,
      });
    });

    Object.values(byState).forEach((list) =>
      list.sort((a, b) => a.name.localeCompare(b.name))
    );

    countiesByStateRef.current = byState;
    countyFeatureMapRef.current = featureMap;
    setStateOptions(Array.from(stateSet).sort());
  }

  // ---------------- UPDATE LEVELS ----------------
  async function updateLevels(selectedSoc, annualSalary) {
    if (!mapRef.current || !countiesRef.current) return;

    const annual = Number(annualSalary);
    if (!Number.isFinite(annual)) return;

    const hourly = annual / HOURS_PER_YEAR;

    const socRes = await fetch(`/data/soc/${selectedSoc}.json`);
    if (!socRes.ok) return;

    const wageTable = await socRes.json();
    const counties = structuredClone(countiesRef.current);
    wageTableRef.current = wageTable;

    counties.features.forEach((f) => {
      delete f.properties.level;

      const state = STATE_FP_TO_ABBR[f.properties.STATEFP];
      if (!state) return;

      const key = `${state}|${normalize(`${f.properties.NAME} County`)}`;
      const levels = wageTable[key];
      if (!levels) return;

      let level = null;
      if (levels.IV && hourly >= levels.IV) level = 4;
      else if (levels.III && hourly >= levels.III) level = 3;
      else if (levels.II && hourly >= levels.II) level = 2;
      else if (levels.I && hourly >= levels.I) level = 1;

      if (level !== null) f.properties.level = level;
    });

    const src = mapRef.current.getSource("counties");
    if (src) src.setData(counties);
    countiesRef.current = counties;
    countyFeatureMapRef.current = Object.fromEntries(
      counties.features.map((f) => [f.properties.GEOID, f])
    );

    mapRef.current.setPaintProperty("county-fill", "fill-color", [
      "case",
      ["==", ["get", "level"], 4],
      LEVEL_COLORS[4], // Level IV
      ["==", ["get", "level"], 3],
      LEVEL_COLORS[3], // Level III
      ["==", ["get", "level"], 2],
      LEVEL_COLORS[2], // Level II
      ["==", ["get", "level"], 1],
      LEVEL_COLORS[1], // Level I
      "#F3F4F6", // below/no-data
    ]);
  }

  function fitToBounds(bounds, options = {}) {
    if (!mapRef.current || !bounds) return;
    mapRef.current.fitBounds(bounds, {
      padding: 30,
      duration: 600,
      ...options,
    });
  }

  function showCountyPopup(feature, lngLat) {
    if (!mapRef.current || !feature) return;

    const state = STATE_FP_TO_ABBR[feature.properties.STATEFP];
    const wageTable = wageTableRef.current;
    const key = state
      ? `${state}|${normalize(`${feature.properties.NAME} County`)}`
      : null;
    const levelInfo = key && wageTable ? wageTable[key] : null;
    const hasLevelData = Boolean(levelInfo);

    const currentLevel = feature.properties.level;
    const levelLabel = !hasLevelData
      ? "No data"
      : currentLevel === undefined
      ? "Below L I"
      : `L ${LEVEL_KEYS[currentLevel - 1]}`;
    const levelClass =
      !hasLevelData || currentLevel === undefined ? "level-none" : "has-level";
    const levelColor =
      currentLevel && LEVEL_COLORS[currentLevel]
        ? LEVEL_COLORS[currentLevel]
        : "#d1d5db";

    const levelRows = LEVEL_KEYS.map((k, idx) => {
      const levelNumber = idx + 1;
      const hourly = levelInfo?.[k];
      const annual = Number.isFinite(hourly)
        ? formatAnnualToK(hourly * HOURS_PER_YEAR)
        : "—";

      return `<div class="level-chip${
        currentLevel === levelNumber ? " is-active" : ""
      }">
                <div class="level-chip-label">L ${k}</div>
                <div class="level-chip-salary">${annual}</div>
              </div>`;
    }).join("");

    const point = lngLat || getFeatureCenter(feature);
    if (!point) return;

    new mapboxgl.Popup({ offset: 12 })
      .setLngLat(point)
      .setHTML(
        `<div class="county-popup-content">
           <div class="popup-top">
             <div>
               <div class="popup-title">${feature.properties.NAME}, ${state}</div>
             </div>
             <span class="level-badge ${levelClass}">
               <span class="level-dot" style="background:${levelColor};"></span>
               <span class="level-badge-text">${levelLabel}</span>
             </span>
           </div>
           <div class="level-grid">
             ${levelRows}
           </div>
         </div>`
      )
      .addClassName("county-popup")
      .addTo(mapRef.current);
  }

  function zoomToState(stateAbbr) {
    if (!countiesRef.current) return;

    let bounds = null;
    countiesRef.current.features
      .filter((f) => STATE_FP_TO_ABBR[f.properties.STATEFP] === stateAbbr)
      .forEach((f) => {
        bounds = mergeBounds(bounds, getBoundsFromGeometry(f.geometry));
      });

    if (bounds) fitToBounds(bounds);
  }

  function zoomToCounty(geoid) {
    const feature = countyFeatureMapRef.current[geoid];
    if (!feature) return;

    const bounds = getBoundsFromGeometry(feature.geometry);
    if (bounds) fitToBounds(bounds, { maxZoom: 8 });

    return feature;
  }

  function handleStateChange(nextState) {
    setSelectedState(nextState);
    setSelectedCounty("");
    setCountyOptions(countiesByStateRef.current[nextState] ?? []);

    if (!nextState) {
      fitToBounds(USA_BOUNDS);
    } else {
      zoomToState(nextState);
    }
  }

  function handleCountyChange(nextCounty) {
    setSelectedCounty(nextCounty);
    if (nextCounty) {
      const feature = zoomToCounty(nextCounty);
      showCountyPopup(feature);
    }
  }

  // ---------------- UI ----------------
  const occupationDisplay = socText || "—";
  const salaryDisplay =
    salary === "" || Number.isNaN(Number(salary))
      ? "—"
      : `$${formatCurrency(Number(salary))}/yr`;

  return (
    <>
      <div className={`control-panel ${collapsed ? "collapsed" : ""}`}>
        {/* Title Row (clickable) */}
        <div
          className="title-row"
          onClick={() => setCollapsed((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setCollapsed((v) => !v);
          }}
          aria-label={collapsed ? "Expand panel" : "Minimize panel"}
        >
          <div className="title">Wagemap</div>
          <div
            className="collapse-icon"
            title={collapsed ? "Expand" : "Minimize"}
          >
            {/* add up arrow logo and down arrow logo */}
            {collapsed ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 9l6 6 6-6H6z" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 15l6-6 6 6H6z" />
              </svg>
            )}
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="subtitle">
              See which wage level your job and salary fall under in each U.S.
              county (tap on it). For better viewing, check it on laptop /
              desktop.
            </div>

            <div className="section panel-card">
              <div className="label-row">
                <label className="label">Location</label>
                <span className="hint">Zooms to your selection</span>
              </div>

              <div className="row">
                <select
                  className="select-box select-half"
                  value={selectedState}
                  onChange={(e) => handleStateChange(e.target.value)}
                >
                  <option value="">All states</option>
                  {stateOptions.map((abbr) => (
                    <option key={abbr} value={abbr}>
                      {abbr}
                    </option>
                  ))}
                </select>
                <select
                  className="select-box select-half"
                  value={selectedCounty}
                  onChange={(e) => handleCountyChange(e.target.value)}
                  disabled={!selectedState}
                >
                  <option value="">
                    {selectedState ? "Select county" : "Choose a state first"}
                  </option>
                  {countyOptions.map((county) => (
                    <option key={county.geoid} value={county.geoid}>
                      {county.name} County
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="section panel-card">
              <div className="label-row">
                <label className="label">Occupation</label>
                <span className="hint">Type to search</span>
              </div>

              <div className="row">
                <SocAutocomplete
                  value={socText}
                  onSelect={(code, display) => {
                    setSoc(code);
                    setSocText(display);
                    updateLevels(code, salary);
                  }}
                />

                <div className="info-wrapper">
                  <span className="info-icon" aria-label="Help">
                    i
                  </span>

                  <div className="info-tooltip">
                    <strong>Can’t find your job title?</strong>
                    <p>
                      Try searching using a broader or more common job title.
                      Many roles are grouped under standard occupational
                      categories.
                    </p>
                    <p>
                      For example, search for <em>Software Developer</em>{" "}
                      instead of <em>Backend Engineer</em>, or{" "}
                      <em>Operations Manager</em> instead of{" "}
                      <em>Program Lead</em>.
                    </p>
                    <p>
                      Once selected, adjust the salary to see which wage level
                      applies by county.
                    </p>
                    <p>
                      Use{" "}
                      <a
                        href="https://www.onetonline.org/find/result"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        O*NET (Occupational Keyword Search)
                      </a>{" "}
                      to find more job titles and SOC codes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="section panel-card">
              <div className="label-row">
                <label className="label">Annual Base Salary</label>
                <span className="hint">Used to determine level</span>
              </div>

              <div className="salary-input">
                <span>$</span>
                <input
                  type="text"
                  value={formatCurrency(salary)}
                  inputMode="numeric"
                  style={{ paddingRight: 28 }}
                  onChange={(e) => {
                    const raw = parseCurrency(e.target.value);
                    if (Number.isNaN(raw)) return;
                    setSalary(raw);
                    updateLevels(soc, raw);
                  }}
                />
                {salary !== "" && (
                  <button
                    type="button"
                    className="clear-btn"
                    aria-label="Clear salary"
                    onClick={() => {
                      setSalary("");
                      updateLevels(soc, Number.NaN);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        {collapsed && (
          <div className="pinned-summary" title="Current selection">
            <div className="pinned-row">
              <span>Occupation</span>
              <span className="pinned-value">{occupationDisplay}</span>
            </div>
            <div className="pinned-row">
              <span>Salary</span>
              <span className="pinned-value">{salaryDisplay}</span>
            </div>
          </div>
        )}

        {/* Legend stays visible even when collapsed */}
        <div className="legend" title="Prevailing wage level color scale">
          <LegendItem color={LEVEL_COLORS[1]} label="Level I" />
          <LegendItem color={LEVEL_COLORS[2]} label="Level II" />
          <LegendItem color={LEVEL_COLORS[3]} label="Level III" />
          <LegendItem color={LEVEL_COLORS[4]} label="Level IV" />
        </div>

        {!collapsed && (
          <>
            {/* Footer */}
            <div className="footer">
              <div className="footer-left">
                <a
                  href="https://github.com/vchrombie/wagemap"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  title="GitHub"
                  className="icon-link"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.43 7.86 10.96.58.11.79-.25.79-.56v-2.17c-3.2.7-3.87-1.55-3.87-1.55-.53-1.36-1.29-1.72-1.29-1.72-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.21 1.79 1.21 1.04 1.78 2.73 1.27 3.4.97.11-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11.07 11.07 0 012.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.11 3.02.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.41-5.25 5.7.42.36.79 1.08.79 2.18v3.23c0 .31.21.67.8.56 4.56-1.53 7.85-5.86 7.85-10.96C23.5 5.74 18.27.5 12 .5z" />
                  </svg>
                </a>

                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share"
                  title="Share"
                  className="icon-button"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a2.5 2.5 0 000-1.39l7.02-4.11A2.99 2.99 0 0018 7.91a3 3 0 10-3-3c0 .23.03.45.08.66L8.05 9.7a3 3 0 100 4.61l7.02 4.11c-.05.2-.07.41-.07.63a3 3 0 103-3z" />
                  </svg>
                </button>
              </div>

              <a
                className="oflc-link"
                href="https://flag.dol.gov/wage-data/wage-search"
                target="_blank"
                rel="noopener noreferrer"
              >
                OFLC Wage Data ↗
              </a>
            </div>

            <div className="credit">
              vibecoded by{" "}
              <a href="https://vchrombie.github.io/" target="_blank">
                <strong>@vchrombie</strong>
              </a>{" "}
              with codex ❤️
            </div>
          </>
        )}
      </div>

      <div id="map" />
    </>
  );
}
