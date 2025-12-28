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

// Must match your preprocessing normalization
const normalize = (s) =>
  s.toLowerCase().replace(" county", "").replace(/\s+/g, " ").trim();

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

  const [collapsed, setCollapsed] = useState(false);
  const [soc, setSoc] = useState("11-1011");
  const [socText, setSocText] = useState("11-1011 – Chief Executives");

  const [salary, setSalary] = useState(150000);

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
          "fill-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "county-outline",
        type: "line",
        source: "counties",
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.3,
        },
      });

      map.on("click", "county-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;

        const state = STATE_FP_TO_ABBR[f.properties.STATEFP];
        const level = f.properties.level ?? "< 1";

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${f.properties.NAME}, ${state}</strong><br/>
             <div style="margin-top:6px;text-align:center;">
               Level <b>${level}</b>
             </div>`
          )
          .addTo(map);
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

  // ---------------- UPDATE LEVELS ----------------
  async function updateLevels(selectedSoc, annualSalary) {
    if (!mapRef.current || !countiesRef.current) return;

    const hourly = annualSalary / HOURS_PER_YEAR;

    const socRes = await fetch(`/data/soc/${selectedSoc}.json`);
    if (!socRes.ok) return;

    const wageTable = await socRes.json();
    const counties = structuredClone(countiesRef.current);

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

    mapRef.current.setPaintProperty("county-fill", "fill-color", [
      "case",
      ["==", ["get", "level"], 4],
      "#4C1D95", // Level IV
      ["==", ["get", "level"], 3],
      "#8B5CF6", // Level III
      ["==", ["get", "level"], 2],
      "#F59E0B", // Level II
      ["==", ["get", "level"], 1],
      "#FEF3C7", // Level I
      "#F3F4F6", // below/no-data
    ]);
  }

  // ---------------- UI ----------------
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

        {/* Everything else hides when collapsed */}
        {!collapsed && (
          <>
            <div className="subtitle">
              See which wage level your job and salary fall under in each U.S.
              county (tap on it). For better viewing, check it on laptop /
              desktop.
            </div>

            <div className="section">
              <label className="label">Occupation</label>

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

            <div className="section">
              <label className="label">Annual Base Salary</label>

              <div className="salary-input">
                <span>$</span>
                <input
                  type="text"
                  value={formatCurrency(salary)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const raw = parseCurrency(e.target.value);
                    if (Number.isNaN(raw)) return;
                    setSalary(raw);
                    updateLevels(soc, raw);
                  }}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="legend" title="Prevailing wage level color scale">
              <LegendItem color="#FEF3C7" label="Level I" />
              <LegendItem color="#F59E0B" label="Level II" />
              <LegendItem color="#8B5CF6" label="Level III" />
              <LegendItem color="#4C1D95" label="Level IV" />
            </div>

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
              with copilot ️❤️
            </div>
          </>
        )}
      </div>

      <div id="map" />
    </>
  );
}
