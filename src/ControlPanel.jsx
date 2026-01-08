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

            {/* add a disclosures link same like oflc-link */}

            <a
              className="disclosures-link"
              href="https://gist.github.com/vchrombie/89f6b9d753b2c49a50ccd1ec97959701"
              target="_blank"
              rel="noopener noreferrer"
            >
              Disclosures ↗
            </a>

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
