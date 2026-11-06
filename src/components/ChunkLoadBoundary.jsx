import { Component } from "react";
import { CHUNK_RELOAD_KEY } from "../utils/lazyWithRecovery.mjs";

export class ChunkLoadBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  retry = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    const url = new URL(window.location.href);
    url.searchParams.set("__chunk_retry", String(Date.now()));
    window.location.replace(url.href);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ maxWidth: 520, margin: "80px auto", padding: 24, textAlign: "center", color: "#9d174d" }}>
          <h2>Page failed to load</h2>
          <p>Refresh to load the latest version of the site.</p>
          <button onClick={this.retry} style={{ border: 0, borderRadius: 10, padding: "12px 24px", color: "#fff", background: "#be185d", fontWeight: 700, cursor: "pointer" }}>
            REFRESH PAGE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
