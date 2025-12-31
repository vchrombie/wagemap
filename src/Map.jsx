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

const LOTTERY_2026_SELECTION = {
  1: 15.29,
  2: 30.58,
  3: 45.87,
  4: 61.16,
};

export default function Map() {
  const mapRef = useRef(null);
  const activePopupRef = useRef(null);
  const activeFeatureRef = useRef(null);
  const countiesRef = useRef(null);
  const countyFeatureMapRef = useRef({});
  const countiesByStateRef = useRef({});
  const wageTableRef = useRef(null);
  const lotteryEnabledRef = useRef(false);

  const [collapsed, setCollapsed] = useState(false);
  const [soc, setSoc] = useState("11-1011");
  const [socText, setSocText] = useState("11-1011 – Chief Executives");

  const [salary, setSalary] = useState(150000);
  const [stateOptions, setStateOptions] = useState([]);
  const [countyOptions, setCountyOptions] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [lotteryEnabled, setLotteryEnabled] = useState(false);

  function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: "WageMap 🇺🇸",
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
          "line-color": "#e3e7ed",
          "line-width": 1,
          "line-opacity": 0.4,
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

    const lotteryEnabled = lotteryEnabledRef.current;
    const state = STATE_FP_TO_ABBR[feature.properties.STATEFP];
    const wageTable = wageTableRef.current;
    const key = state
      ? `${state}|${normalize(`${feature.properties.NAME} County`)}`
      : null;
    const levelInfo = key && wageTable ? wageTable[key] : null;
    const hasLevelData = Boolean(levelInfo);

    const currentLevel = feature.properties.level;
    const chance = currentLevel
      ? LOTTERY_2026_SELECTION[currentLevel]
      : undefined;

    const levelLabel = !hasLevelData
      ? "No data"
      : currentLevel === undefined
      ? "Below Level I"
      : `Level ${LEVEL_KEYS[currentLevel - 1]}`;
    const levelClass =
      !hasLevelData || currentLevel === undefined ? "level-none" : "has-level";
    const levelColor =
      currentLevel && LEVEL_COLORS[currentLevel]
        ? LEVEL_COLORS[currentLevel]
        : "#d1d5db";

    const salaryFloors = LEVEL_KEYS.map((k) => {
      const hourly = levelInfo?.[k];
      if (!Number.isFinite(hourly)) return "—";

      const annual = hourly * HOURS_PER_YEAR;
      return `${formatAnnualToK(annual)}+`;
    });

    const levelRows = LEVEL_KEYS.map((k, idx) => {
      const levelNumber = idx + 1;
      const salaryRange = salaryFloors[idx];
      const rowChance = lotteryEnabled
        ? LOTTERY_2026_SELECTION[levelNumber]
        : null;
      const chanceCell =
        lotteryEnabled && rowChance !== null
          ? `<td class="chance-col">${
              Number.isFinite(rowChance) ? `${rowChance}%` : "—"
            }</td>`
          : "";

      return `<tr class="${
        currentLevel === levelNumber ? "is-active-row" : ""
      }">
                <td class="level-col">L ${k}</td>
                <td class="salary-col">${salaryRange}</td>
                ${chanceCell}
              </tr>`;
    }).join("");

    const chanceNote = lotteryEnabled ? "Chances of on 2027 lottery." : "";
    const selectionLine =
      lotteryEnabled && chance
        ? `You have a ${chance}% probability of being selected to file an H-1B petition in 2027.`
        : "";

    const point = lngLat || getFeatureCenter(feature);
    if (!point) return;

    activePopupRef.current?.remove();
    const popup = new mapboxgl.Popup({ offset: 12, focusAfterOpen: false })
      .setLngLat(point)
      .setHTML(
        `<div class="county-popup-content">
           <div class="popup-top">
             <div>
               <div class="popup-title">${
                 feature.properties.NAME
               }, ${state}</div>
             </div>
             <span class="level-badge ${levelClass}">
               <span class="level-dot" style="background:${levelColor};"></span>
               <span class="level-badge-text">${levelLabel}</span>
             </span>
           </div>
           ${
             selectionLine
               ? `<div class="selection-line">${selectionLine}</div>`
               : ""
           }
           <div class="level-table-wrapper">
             <table class="level-table" role="table">
               <thead>
                 <tr>
                   <th>Level</th>
                   <th>Salary</th>
                   ${lotteryEnabled ? "<th>Probability</th>" : ""}
                 </tr>
               </thead>
               <tbody>
                 ${levelRows}
               </tbody>
             </table>
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

  useEffect(() => {
    lotteryEnabledRef.current = lotteryEnabled;
    const active = activeFeatureRef.current;
    if (!active) return;

    const updatedFeature = countyFeatureMapRef.current[active.geoid];
    if (updatedFeature) {
      showCountyPopup(updatedFeature, active.point);
    }
  }, [lotteryEnabled]);

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
        lotteryEnabled={lotteryEnabled}
        onToggleLottery={() => setLotteryEnabled((v) => !v)}
      />

      <div id="map" />
    </>
  );
}
