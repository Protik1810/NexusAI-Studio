import React from 'react';
import { X, Check, Sparkles, Sliders, Image as ImageIcon } from 'lucide-react';

export type AppThemeId = 'dark' | 'neon' | 'cinema' | 'synthwave' | 'anime' | 'matrix';

export interface ThemeOption {
  id: AppThemeId;
  name: string;
  category: string;
  description: string;
  wallpaper: string;
  /** Transparent per-theme brand emblem — same art used on the showcase website. */
  emblem: string;
  colors: {
    accent: string;
    secondary: string;
    bg: string;
  };
  tags: string[];
}

export const APP_THEMES: ThemeOption[] = [
  {
    id: 'dark',
    name: 'Dark Void',
    category: 'Generative AI Cosmic Art',
    description: 'Deep space nebula with swirling purple cosmic dust and glowing cyan neural lattice.',
    wallpaper: '/themes/dark-void.jpg',
    emblem: '/themes/emblem/dark-void.webp',
    colors: {
      accent: '#8b5cf6',
      secondary: '#06b6d4',
      bg: '#050810'
    },
    tags: ['Cosmic', 'Neural Net', 'Deep Violet']
  },
  {
    id: 'neon',
    name: 'Neon Cyber',
    category: 'Generative AI Cyberpunk',
    description: 'Rain-slicked Neo-Tokyo streets reflecting glowing cyan billboards and electric pink holograms.',
    wallpaper: '/themes/neon-cyber.jpg',
    emblem: '/themes/emblem/neon-cyber.webp',
    colors: {
      accent: '#06b6d4',
      secondary: '#ec4899',
      bg: '#030a12'
    },
    tags: ['Cyberpunk', 'Rain Slick', 'Electric Cyan']
  },
  {
    id: 'cinema',
    name: 'Cinema Gold',
    category: 'Generative AI Film Set',
    description: 'Classic vintage film studio with golden amber spotlights, warm bokeh, and 35mm grain.',
    wallpaper: '/themes/cinema-gold.jpg',
    emblem: '/themes/emblem/cinema-gold.webp',
    colors: {
      accent: '#f59e0b',
      secondary: '#b45309',
      bg: '#0d0900'
    },
    tags: ['Hollywood', 'Warm Amber', 'Vintage Film']
  },
  {
    id: 'synthwave',
    name: 'Synthwave Sunset',
    category: 'Generative AI Retro 80s',
    description: 'Giant wireframe sun over purple chrome mountains with reflective neon grid highways.',
    wallpaper: '/themes/synthwave.jpg',
    emblem: '/themes/emblem/synthwave.webp',
    colors: {
      accent: '#ec4899',
      secondary: '#8b5cf6',
      bg: '#0e0618'
    },
    tags: ['Outrun 80s', 'Magenta Glow', 'Vaporwave']
  },
  {
    id: 'anime',
    name: 'Anime Fantasy',
    category: 'Generative AI Anime Scenery',
    description: 'Floating sacred shrine islands surrounded by luminous cherry blossoms under aurora twin moons.',
    wallpaper: '/themes/anime-fantasy.jpg',
    emblem: '/themes/emblem/anime-fantasy.webp',
    colors: {
      accent: '#f43f5e',
      secondary: '#38bdf8',
      bg: '#080d22'
    },
    tags: ['Makoto Shinkai', 'Sakura Glow', 'Floating Island']
  },
  {
    id: 'matrix',
    name: 'Emerald Matrix',
    category: 'Generative AI Tech Mainframe',
    description: 'Bioluminescent emerald circuits and holographic data streams flowing through obsidian mainframe glass.',
    wallpaper: '/themes/emerald-matrix.jpg',
    emblem: '/themes/emblem/emerald-matrix.webp',
    colors: {
      accent: '#10b981',
      secondary: '#06b6d4',
      bg: '#020d07'
    },
    tags: ['Cyber Matrix', 'Bio Green', 'High Tech']
  }
];

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: AppThemeId;
  onSelectTheme: (themeId: AppThemeId) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10, 15, 28, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(6, 182, 212, 0.15)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary, #8b5cf6) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px var(--accent-glow)'
              }}
            >
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Visual Themes & Art Wallpapers
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Every theme features distinct AI-generated backdrop art and adaptive glassmorphism color palettes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="icon-btn"
            style={{ width: '36px', height: '36px' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Themes Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}
        >
          {APP_THEMES.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <div
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                style={{
                  background: isSelected ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected
                    ? `2px solid ${theme.colors.accent}`
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isSelected
                    ? `0 12px 30px -10px ${theme.colors.accent}60, 0 0 20px ${theme.colors.accent}30`
                    : '0 4px 15px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                {/* Wallpaper Preview Banner */}
                <div
                  style={{
                    position: 'relative',
                    height: '140px',
                    width: '100%',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={theme.wallpaper}
                    alt={theme.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s ease'
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.06)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.0)';
                    }}
                  />

                  {/* Gradient overlay on thumbnail */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(10,15,28,0.85) 100%)'
                    }}
                  />

                  {/* Category Pill */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '20px',
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ImageIcon size={10} color={theme.colors.accent} />
                    {theme.category}
                  </div>

                  {/* Active Badge */}
                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: theme.colors.accent,
                        color: '#fff',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: `0 0 12px ${theme.colors.accent}`
                      }}
                    >
                      <Check size={12} strokeWidth={3} /> Active
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {theme.name}
                    </h3>
                    {/* Palette Chips */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div
                        title="Primary Accent"
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.accent,
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                      <div
                        title="Secondary Accent"
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.secondary,
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.5',
                      margin: '0 0 12px 0',
                      flex: 1
                    }}
                  >
                    {theme.description}
                  </p>

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {theme.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '10px',
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)',
                          border: '1px solid rgba(255, 255, 255, 0.06)'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Apply Button */}
                  <button
                    type="button"
                    onClick={() => onSelectTheme(theme.id)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isSelected
                        ? theme.colors.accent
                        : 'rgba(255, 255, 255, 0.06)',
                      border: isSelected
                        ? `1px solid ${theme.colors.accent}`
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} /> Applied Theme
                      </>
                    ) : (
                      'Apply Theme'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}
        >
          <span>💡 Wallpaper backdrops blend seamlessly with dark glassmorphism surfaces.</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};