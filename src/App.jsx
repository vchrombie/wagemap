import React from "react";
import Map from "./Map";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Map />
      <Analytics />
    </div>
  );
}
