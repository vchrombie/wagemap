import React from "react";
import LegendItem from "./LegendItem";
import SocAutocomplete from "./SocAutocomplete";
import { LEVEL_COLORS, formatCurrency } from "./mapUtils";

export default function ControlPanel({
  collapsed,
  onToggleCollapse,
  stateOptions,
  countyOptions,
  selectedState,
  selectedCounty,
  onStateChange,
  onCountyChange,
  socText,
  onSocSelect,
  salary,
  onSalaryChange,
  onClearSalary,
  occupationDisplay,
  salaryDisplay,
  handleShare,
  lotteryEnabled,
  onToggleLottery,
}) {
  return (
    <div className={`control-panel ${collapsed ? "collapsed" : ""}`}>
      {/* Title Row (clickable) */}
      <div
        className="title-row"
        onClick={onToggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleCollapse();
        }}
        aria-label={collapsed ? "Expand panel" : "Minimize panel"}
      >
        <div className="title">WageMap 🇺🇸</div>
        <div
          className="collapse-icon"
          title={collapsed ? "Expand" : "Minimize"}
        >
          {/* add up arrow logo and down arrow logo */}
          {collapsed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 9l6 6 6-6H6z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 15l6-6 6 6H6z" />
            </svg>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="subtitle">
            Select your state or county, occupation, and salary. Explore the
            map. For the best experience, use a desktop or laptop.
          </div>

          <div className="section panel-card">
            <div className="label-row">
              <label className="label">Location</label>
              <span className="hint">
                Automatically zooms to the state/county
              </span>
            </div>

            <div className="row">
              <select
                className="select-box select-half"
                value={selectedState}
                onChange={(e) => onStateChange(e.target.value)}
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
                onChange={(e) => onCountyChange(e.target.value)}
                disabled={!selectedState}
              >
                <option value="">
                  {selectedState ? "Select county" : "Pick a state first"}
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
              <SocAutocomplete value={socText} onSelect={onSocSelect} />

              <div className="info-wrapper">
                <span className="info-icon" aria-label="Help">
                  <svg
                    width="100"
                    height="100"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>{" "}
                </span>

                <div className="info-tooltip">
                  <strong>Can’t find your job title?</strong>
                  <p>
                    Try searching using a broader or more common job title. Many
                    roles are grouped under standard occupational categories.
                  </p>
                  <p>
                    For example, search for <em>Software Developer</em> instead
                    of <em>Backend Engineer</em>, or <em>Operations Manager</em>{" "}
                    instead of <em>Program Lead</em>.
                  </p>
                  <p>
                    Once selected, adjust the salary to see which wage level
                    applies by county.
                  </p>
                  <p>
                    Try{" "}
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
              <span className="hint">Used to determine wage level</span>
            </div>

            <div className="salary-row">
              <div className="salary-input">
                <span>$</span>
                <input
                  type="text"
                  value={formatCurrency(salary)}
                  inputMode="numeric"
                  style={{ paddingRight: 28 }}
                  onChange={(e) => onSalaryChange(e.target.value)}
                />
                {salary !== "" && (
                  <button
                    type="button"
                    className="clear-btn"
                    aria-label="Clear salary"
                    onClick={onClearSalary}
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                type="button"
                className="search-collapse-btn"
                aria-label="Minimize control panel"
                title="Minimize panel"
                onClick={onToggleCollapse}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10 2a8 8 0 015.292 13.708l4 4-1.414 1.414-4-4A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="section panel-card">
            <div className="toggle-row">
              <div className="toggle-copy">
                {/* <div className="toggle-title">Are you interested to look the chances of your H1B lottery for the year 2027?</div> */}
                <div className="toggle-subtitle">
                  Would you like to see your chances in the H-1B lottery for the
                  year 2027?
                </div>
              </div>
              <div className="toggle-stack">
                <button
                  type="button"
                  className={`toggle ${lotteryEnabled ? "on" : ""}`}
                  aria-pressed={lotteryEnabled}
                  onClick={onToggleLottery}
                  aria-label="Toggle lottery selection chances"
                >
                  <span className="toggle-handle" />
                </button>
                <span className="toggle-state-text">
                  {lotteryEnabled ? "On" : "Off"}
                </span>
              </div>
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
            Built by{" "}
            <a href="https://vchrombie.github.io/" target="_blank">
              <strong>@vchrombie</strong>
            </a>{" "}
            with Codex ❤️
          </div>
        </>
      )}
    </div>
  );
}
