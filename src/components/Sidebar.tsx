import React, { useState, useEffect } from "react";
import { Image, MessageSquare, Images, Database, Settings, Palette, Info } from "lucide-react";
import { ComfyStatus } from "../services/comfyApi";
import { LLMStatus } from "../services/llmApi";
import { ThemeModal, AppThemeId, APP_THEMES } from "./ThemeModal";

export type TabType = "image" | "chat" | "gallery" | "models" | "about" | "settings";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  comfyStatus: ComfyStatus;
  llmStatus: LLMStatus;
}

function applyTheme(theme: AppThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("nexus-theme", theme);
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  comfyStatus,
  llmStatus
}) => {
  const [currentTheme, setCurrentTheme] = useState<AppThemeId>(() => {
    return (localStorage.getItem("nexus-theme") as AppThemeId) || "dark";
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
          title="NexusAI Studio — Generative AI Workspace"
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
              alt="NexusAI Logo"
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

          {/* About Tab — placed after Model Hub */}
          <button
            className={`sidebar-icon ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
            title="About NexusAI Studio & Creator Protik"
          >
            <Info size={22} />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Visual Theme Gallery Trigger */}
        <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
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

        {/* Backend Status Indicators */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <div
            title={`ComfyUI: ${comfyStatus.connected ? "Online" : "Offline"}`}
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: comfyStatus.connected ? "#10b981" : "#ef4444",
              boxShadow: comfyStatus.connected ? "0 0 8px #10b981" : "none",
              cursor: "pointer"
            }}
            onClick={() => setActiveTab("settings")}
          />
          <div
            title={`LLM Engine: ${llmStatus.connected ? "Online" : "Offline"}`}
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: llmStatus.connected ? "#06b6d4" : "#64748b",
              boxShadow: llmStatus.connected ? "0 0 8px #06b6d4" : "none",
              cursor: "pointer"
            }}
            onClick={() => setActiveTab("settings")}
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