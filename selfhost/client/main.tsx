import "@/styles.css";
import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Game from "@/game/Game";

// Shows the real error instead of a black screen, so server problems can be diagnosed.
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    const e = this.state.err;
    if (!e) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: "monospace", color: "#e5e5e5", background: "#0b0d0b", minHeight: "100vh" }}>
        <h1 style={{ color: "#f97316" }}>Mäng ei käivitunud</h1>
        <p>Viga: {e.message}</p>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.7 }}>{e.stack}</pre>
        <button style={{ marginTop: 12, padding: 8, border: "2px solid #4ade80" }} onClick={() => location.reload()}>Proovi uuesti</button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(<Boundary><Game /></Boundary>);
