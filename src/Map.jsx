import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import { STATE_FP_TO_ABBR } from "./stateFpToAbbr";
import ControlPanel from "./ControlPanel";
import {
  HOURS_PER_YEAR,
  USA_BOUNDS,
  LEVEL_KEYS,
  LEVEL_COLORS,
  formatCurrency,
  parseCurrency,
  formatAnnualToK,
  normalize,
  getBoundsFromGeometry,
  getFeatureCenter,
  mergeBounds,
} from "./mapUtils";

import "./Map.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Map() {
  const mapRef = useRef(null);
  const activePopupRef = useRef(null);
  const activeFeatureRef = useRef(null);
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

    return () => {
      activePopupRef.current?.remove();
      map.remove();
    };
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

  function clearActivePopup() {
    activePopupRef.current?.remove();
    activePopupRef.current = null;
    activeFeatureRef.current = null;
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

    const active = activeFeatureRef.current;
    if (active) {
      const updatedFeature = countyFeatureMapRef.current[active.geoid];
      if (updatedFeature) {
        showCountyPopup(updatedFeature, active.point);
      } else {
        clearActivePopup();
      }
    }
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

    activePopupRef.current?.remove();
    const popup = new mapboxgl.Popup({ offset: 12, focusAfterOpen: false })
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

    activeFeatureRef.current = { geoid: feature.properties.GEOID, point };
    activePopupRef.current = popup;
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
    clearActivePopup();

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
    } else {
      clearActivePopup();
    }
  }

  function handleSocSelect(code, display) {
    setSoc(code);
    setSocText(display);
    updateLevels(code, salary);
  }

  function handleSalaryChange(nextValue) {
    const raw = parseCurrency(nextValue);
    if (Number.isNaN(raw)) return;
    setSalary(raw);
    updateLevels(soc, raw);
  }

  function handleSalaryClear() {
    setSalary("");
    updateLevels(soc, Number.NaN);
  }

  // ---------------- UI ----------------
  const occupationDisplay = socText || "—";
  const salaryDisplay =
    salary === "" || Number.isNaN(Number(salary))
      ? "—"
      : `$${formatCurrency(Number(salary))}/yr`;

  return (
    <>
      <ControlPanel
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        stateOptions={stateOptions}
        countyOptions={countyOptions}
        selectedState={selectedState}
        selectedCounty={selectedCounty}
        onStateChange={handleStateChange}
        onCountyChange={handleCountyChange}
        socText={socText}
        onSocSelect={handleSocSelect}
        salary={salary}
        onSalaryChange={handleSalaryChange}
        onClearSalary={handleSalaryClear}
        occupationDisplay={occupationDisplay}
        salaryDisplay={salaryDisplay}
        handleShare={handleShare}
      />

      <div id="map" />
    </>
  );
}
