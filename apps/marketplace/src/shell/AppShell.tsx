import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { T } from "../design/tokens";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { Copilot } from "./Copilot";
import { CopilotContext } from "./CopilotContext";
import { useMediaQuery } from "../shared/ui/useMediaQuery";

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <CopilotContext.Provider value={{ open: () => setCopilotOpen(true) }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text }}>
        <Topbar
          onOpenCommandPalette={() => setPaletteOpen(true)}
          onOpenCopilot={() => setCopilotOpen(true)}
          onOpenMobileNav={isMobile ? () => setMobileNavOpen(true) : undefined}
        />
        <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
          {isMobile ? (
            mobileNavOpen && (
              <>
                <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }} />
                <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 91 }}>
                  <Sidebar mobile onNavigate={() => setMobileNavOpen(false)} />
                </div>
              </>
            )
          ) : (
            <Sidebar />
          )}
          <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
            <Outlet />
          </main>
        </div>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <Copilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      </div>
    </CopilotContext.Provider>
  );
}
