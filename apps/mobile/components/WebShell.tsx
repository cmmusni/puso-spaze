// ─────────────────────────────────────────────
// components/WebShell.tsx
// On web: injects global CSS for responsive layout.
// No-op on native platforms.
// ─────────────────────────────────────────────

import React, { useEffect } from "react";
import { Platform } from "react-native";

interface Props {
  children: React.ReactNode;
}

export default function WebShell({ children }: Props) {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Inject global CSS to make the app fill the viewport
    const style = document.createElement("style");
    style.textContent = `
      html, body, #root {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return <>{children}</>;
}
