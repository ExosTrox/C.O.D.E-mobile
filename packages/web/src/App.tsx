import { API_VERSION } from "@code-mobile/core";

export function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#00ff41",
        fontFamily: "monospace",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <h1>CODE Mobile</h1>
      <p>Your AI-powered terminal, everywhere.</p>
      <p style={{ color: "#666", fontSize: "0.875rem" }}>API {API_VERSION}</p>
    </div>
  );
}
