import React, { useEffect, useRef, useState } from "react";

export default function SocAutocomplete({ value, onSelect }) {
  const wrapperRef = useRef(null);

  const [options, setOptions] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Load SOC options
  useEffect(() => {
    fetch("/data/soc_codes.json")
      .then((r) => r.json())
      .then(setOptions);
  }, []);

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filtered = options.filter((o) =>
    `${o.code} ${o.title}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: 280 }}>
      <input
        type="text"
        value={query}
        placeholder="Enter job title or SOC code"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        style={{ width: "100%", padding: "6px" }}
      />

      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            background: "#fff",
            border: "1px solid #ccc",
            maxHeight: 200,
            overflowY: "auto",
            width: "100%",
            fontSize: 14,
          }}
        >
          {filtered.map((o) => (
            <div
              key={o.code}
              onClick={() => {
                onSelect(o.parent);
                setQuery(`${o.code} – ${o.title}`);
                setOpen(false);
              }}
              style={{
                padding: "6px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
              }}
            >
              <strong>{o.code}</strong> — {o.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
