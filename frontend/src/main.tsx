import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import "./index.css";
import App from "./App";

const convexUrl = (import.meta.env.VITE_CONVEX_URL as string)?.trim().replace(/\/$/, "") || "";
// basename matches Vite base for GitHub Pages (e.g. /team-04/)
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

function AppRoot() {
  if (!convexUrl) {
    return (
      <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: "480px" }}>
        <h1 style={{ marginTop: 0 }}>Timemaxx</h1>
        <p>
          Backend not configured. Set the <code>VITE_CONVEX_URL</code> secret in GitHub Actions
          (Settings → Secrets) to your production Convex URL, then re-run the CD workflow.
        </p>
      </div>
    );
  }

  const convex = new ConvexReactClient(convexUrl);
  return (
    <ConvexAuthProvider client={convex}>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ConvexAuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>
);
