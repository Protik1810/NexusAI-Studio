import React, { useState, useEffect } from "react";
import { Image, MessageSquare, Images, Database, Settings, Palette, Info } from "lucide-react";
import { ThemeModal, AppThemeId, APP_THEMES } from "./ThemeModal";

export type TabType = "image" | "chat" | "gallery" | "models" | "about" | "settings";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isEngineRunning?: boolean;
  librariesReady?: boolean;
  missingLibrariesCount?: number;
}

function applyTheme(theme: AppThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("solframe-theme", theme);
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isEngineRunning = false,
  librariesReady = true,
  missingLibrariesCount = 0
}) => {
  const [currentTheme, setCurrentTheme] = useState<AppThemeId>(() => {
    return (localStorage.getItem("solframe-theme") as AppThemeId) || "cinema";
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  useEffect(() => {
    applyTheme(currentTheme);
  }, []);

  const handleSelectTheme = (themeId: AppThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
  };

  const activeThemeMeta = APP_THEMES.find((t) => t.id === currentTheme) || APP_THEMES[0];

  const hasMissingLibraries = !librariesReady || missingLibrariesCount > 0;
  const indicatorClass = hasMissingLibraries
    ? "engine-indicator-missing"
    : isEngineRunning
    ? "engine-indicator-running"
    : "engine-indicator-ready";

  const indicatorTooltip = hasMissingLibraries
    ? `⚠️ ${missingLibrariesCount} Acceleration Library Missing (Click to Open Library Manager)`
    : isEngineRunning
    ? "⚡ Inference Engine Active (Generating on GPU/CPU)"
    : "🟡 Hardware Libraries Loaded & Ready (Idle)";

  return (
    <>
      <aside className="sidebar glass-panel">
        {/* Brand Logo & Emblem */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            paddingBottom: "8px"
          }}
          onClick={() => setActiveTab("image")}
          title="Solframe Studio — Generative AI Workspace"
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary, #8b5cf6) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 22px var(--accent-glow)",
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 0 28px var(--accent-glow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 0 22px var(--accent-glow)";
            }}
          >
            <img
              src="/logo.png"
              alt="Solframe Logo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", alignItems: "center" }}>
          <button
            className={`sidebar-icon ${activeTab === "image" ? "active" : ""}`}
            onClick={() => setActiveTab("image")}
            title="Image Studio (FLUX.2 & SDXL Lightning)"
          >
            <Image size={22} />
          </button>

          <button
            className={`sidebar-icon ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
            title="Uncensored LLM Chat (llama.cpp)"
          >
            <MessageSquare size={22} />
          </button>

          <button
            className={`sidebar-icon ${activeTab === "gallery" ? "active" : ""}`}
            onClick={() => setActiveTab("gallery")}
            title="Generated Artwork Gallery"
          >
            <Images size={22} />
          </button>

          <button
            className={`sidebar-icon ${activeTab === "models" ? "active" : ""}`}
            onClick={() => setActiveTab("models")}
            title="Model Hub & System Models"
          >
            <Database size={22} />
          </button>

          {/* About Tab */}
          <button
            className={`sidebar-icon ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
            title="About Solframe Studio, Libraries & Creator Protik"
          >
            <Info size={22} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Visual Theme Gallery Trigger */}
        <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button
            className="sidebar-icon"
            onClick={() => setIsThemeModalOpen(true)}
            title={`Visual Themes: Active '${activeThemeMeta.name}' (Click to open theme gallery)`}
            style={{
              position: "relative",
              border: `1px solid ${activeThemeMeta.colors.accent}40`,
              background: `radial-gradient(circle, ${activeThemeMeta.colors.accent}20 0%, transparent 80%)`
            }}
          >
            <Palette size={20} color={activeThemeMeta.colors.accent} />
            {/* Active Theme Color Indicator Dot */}
            <span
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: activeThemeMeta.colors.accent,
                boxShadow: `0 0 8px ${activeThemeMeta.colors.accent}`
              }}
            />
          </button>
        </div>

        {/* Engine & Acceleration Library Status Indicator */}
        <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            className={indicatorClass}
            title={indicatorTooltip}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              cursor: "pointer",
              transition: "transform 0.2s"
            }}
            onClick={() => setActiveTab("about")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          />
        </div>

        {/* Settings Tab */}
        <button
          className={`sidebar-icon ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
          title="Hardware & Engine Settings"
        >
          <Settings size={22} />
        </button>
      </aside>


      {/* Visual Theme Gallery Modal */}
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
      />
    </>
  );
};