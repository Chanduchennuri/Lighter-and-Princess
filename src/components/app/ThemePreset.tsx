import { useEffect, useState } from "react"
import { Check, Grid3X3, Palette, RotateCcw } from "lucide-react"

type ThemeId = "zinc" | "nordic" | "emerald" | "amber"

interface ThemePresetItem {
  id: ThemeId
  name: string
  description: string
  previewClass: string
  accent: string
  accentSoft: string
  pageBackground: string
  grid: string
  text: string
  muted: string
}

const STORAGE_KEY = "lp.theme-preset"
const GRID_STORAGE_KEY = "lp.background-grid"

const themes: ThemePresetItem[] = [
  {
    id: "zinc",
    name: "Zinc Midnight",
    description: "Deep graphite with a cool L&P accent",
    previewClass: "bg-slate-800",
    accent: "#94a3b8",
    accentSoft: "rgba(148,163,184,0.16)",
    pageBackground: "#0b0f17",
    grid: "rgba(148,163,184,0.08)",
    text: "#f8fafc",
    muted: "#94a3b8",
  },
  {
    id: "nordic",
    name: "Nordic Snow",
    description: "Clean, bright and minimal",
    previewClass: "bg-white border border-slate-300",
    accent: "#475569",
    accentSoft: "rgba(71,85,105,0.10)",
    pageBackground: "#f8fafc",
    grid: "rgba(100,116,139,0.10)",
    text: "#0f172a",
    muted: "#64748b",
  },
  {
    id: "emerald",
    name: "Cyber Emerald",
    description: "Dark mode with an energetic green accent",
    previewClass: "bg-emerald-500",
    accent: "#34d399",
    accentSoft: "rgba(52,211,153,0.15)",
    pageBackground: "#07120f",
    grid: "rgba(52,211,153,0.08)",
    text: "#ecfdf5",
    muted: "#86efac",
  },
  {
    id: "amber",
    name: "Amber OLED",
    description: "Warm terminal-inspired OLED mode",
    previewClass: "bg-amber-500",
    accent: "#f59e0b",
    accentSoft: "rgba(245,158,11,0.15)",
    pageBackground: "#100c05",
    grid: "rgba(245,158,11,0.08)",
    text: "#fffbeb",
    muted: "#fbbf24",
  },
]

function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") {
    return "nordic"
  }

  const saved = window.localStorage.getItem(STORAGE_KEY)

  if (
    saved === "zinc" ||
    saved === "nordic" ||
    saved === "emerald" ||
    saved === "amber"
  ) {
    return saved
  }

  return "nordic"
}

function getStoredGrid(): boolean {
  if (typeof window === "undefined") {
    return true
  }

  const saved = window.localStorage.getItem(GRID_STORAGE_KEY)

  if (saved === null) {
    return true
  }

  return saved === "true"
}

function applyTheme(
  theme: ThemePresetItem,
  gridEnabled: boolean,
) {
  if (typeof document === "undefined") {
    return
  }

  const root = document.documentElement
  const body = document.body

  root.dataset.lpTheme = theme.id

  root.style.setProperty(
    "--lp-page-background",
    theme.pageBackground,
  )

  root.style.setProperty(
    "--lp-theme-accent",
    theme.accent,
  )

  root.style.setProperty(
    "--lp-theme-accent-soft",
    theme.accentSoft,
  )

  root.style.setProperty(
    "--lp-theme-text",
    theme.text,
  )

  root.style.setProperty(
    "--lp-theme-muted",
    theme.muted,
  )

  body.style.backgroundColor = theme.pageBackground
  body.style.color = theme.text

  let grid = document.getElementById(
    "lp-background-grid",
  )

  if (!grid) {
    grid = document.createElement("div")

    grid.id = "lp-background-grid"

    grid.setAttribute(
      "aria-hidden",
      "true",
    )

    Object.assign(grid.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "0",
      opacity: "0",
      transition: "opacity 180ms ease",
      backgroundSize: "24px 24px",
      maskImage:
        "linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
      WebkitMaskImage:
        "linear-gradient(to bottom, black 0%, black 72%, transparent 100%)",
    })

    document.body.prepend(grid)
  }

  grid.style.backgroundImage =
    `linear-gradient(to right, ${theme.grid} 1px, transparent 1px), ` +
    `linear-gradient(to bottom, ${theme.grid} 1px, transparent 1px)`

  grid.style.opacity = gridEnabled ? "1" : "0"
}

function notifyAppearanceChanged(
  theme: ThemeId,
  gridEnabled: boolean,
) {
  window.dispatchEvent(
    new CustomEvent(
      "lp:appearance-changed",
      {
        detail: {
          theme,
          backgroundGrid: gridEnabled,
        },
      },
    ),
  )
}

export function ThemePreset() {
  const [selected, setSelected] =
    useState<ThemeId>(getStoredTheme)

  const [gridEnabled, setGridEnabled] =
    useState<boolean>(getStoredGrid)

  const selectedTheme =
    themes.find(
      (theme) => theme.id === selected,
    ) ?? themes[1]

  useEffect(() => {
    applyTheme(
      selectedTheme,
      gridEnabled,
    )

    window.localStorage.setItem(
      STORAGE_KEY,
      selected,
    )

    window.localStorage.setItem(
      GRID_STORAGE_KEY,
      String(gridEnabled),
    )

    notifyAppearanceChanged(
      selected,
      gridEnabled,
    )
  }, [
    selected,
    gridEnabled,
    selectedTheme,
  ])

  const handleThemeSelect = (
    theme: ThemePresetItem,
  ) => {
    setSelected(theme.id)
  }

  const handleGridToggle = () => {
    setGridEnabled(
      (current) => !current,
    )
  }

  const handleReset = () => {
    setSelected("nordic")
    setGridEnabled(true)
  }

  return (
    <section
      className="
        rounded-[24px]
        border
        p-5
        shadow-[0_12px_35px_rgba(30,45,65,0.07)]
        backdrop-blur-xl
        transition-all
      "
      style={{
        backgroundColor:
          `color-mix(in srgb, ${selectedTheme.pageBackground} 90%, white 10%)`,
        borderColor:
          `color-mix(in srgb, ${selectedTheme.accent} 22%, transparent)`,
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-xl
            "
            style={{
              backgroundColor:
                selectedTheme.accentSoft,
              color:
                selectedTheme.accent,
            }}
          >
            <Palette size={15} />
          </div>

          <div>
            <p
              className="
                font-mono
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.2em]
              "
              style={{
                color:
                  selectedTheme.muted,
              }}
            >
              Appearance
            </p>

            <p
              className="
                mt-1
                text-sm
                font-semibold
              "
              style={{
                color:
                  selectedTheme.text,
              }}
            >
              Choose your L&P atmosphere
            </p>
          </div>
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={handleReset}
          title="Reset appearance"
          aria-label="Reset appearance"
          className="
            rounded-lg
            p-1.5
            transition-all
            hover:bg-black/5
            dark:hover:bg-white/5
          "
          style={{
            color:
              selectedTheme.muted,
          }}
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Theme presets */}
      <div className="grid grid-cols-2 gap-2">
        {themes.map((theme) => {
          const active =
            selected === theme.id

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() =>
                handleThemeSelect(theme)
              }
              aria-pressed={active}
              className="
                group
                relative
                flex
                min-h-[68px]
                items-start
                gap-2
                rounded-xl
                border
                p-3
                text-left
                transition-all
                hover:-translate-y-0.5
              "
              style={{
                borderColor: active
                  ? theme.accent
                  : `color-mix(in srgb, ${theme.accent} 18%, transparent)`,

                backgroundColor: active
                  ? theme.accentSoft
                  : "rgba(255,255,255,0.42)",
              }}
            >
              {/* Color dot */}
              <span
                className={`
                  mt-0.5
                  h-3
                  w-3
                  shrink-0
                  rounded-full
                  ${theme.previewClass}
                `}
              />

              {/* Theme information */}
              <span className="min-w-0 flex-1">
                <span
                  className="
                    block
                    truncate
                    text-[10px]
                    font-semibold
                  "
                  style={{
                    color:
                      theme.text,
                  }}
                >
                  {theme.name}
                </span>

                <span
                  className="
                    mt-0.5
                    block
                    line-clamp-2
                    text-[9px]
                    leading-4
                  "
                  style={{
                    color:
                      theme.muted,
                  }}
                >
                  {theme.description}
                </span>
              </span>

              {/* Active icon */}
              {active && (
                <span
                  className="
                    absolute
                    right-2
                    top-2
                  "
                  style={{
                    color:
                      theme.accent,
                  }}
                >
                  <Check
                    size={13}
                    strokeWidth={2.5}
                  />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Background grid */}
      <div
        className="
          mt-5
          border-t
          pt-4
        "
        style={{
          borderColor:
            `color-mix(in srgb, ${selectedTheme.accent} 16%, transparent)`,
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center
                rounded-lg
              "
              style={{
                backgroundColor:
                  selectedTheme.accentSoft,
                color:
                  selectedTheme.accent,
              }}
            >
              <Grid3X3 size={13} />
            </div>

            <div className="min-w-0">
              <p
                className="
                  text-xs
                  font-semibold
                "
                style={{
                  color:
                    selectedTheme.text,
                }}
              >
                Background Grid
              </p>

              <p
                className="
                  text-[9px]
                  leading-4
                "
                style={{
                  color:
                    selectedTheme.muted,
                }}
              >
                Subtle workspace grid across the app
              </p>
            </div>
          </div>

          {/* Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={gridEnabled}
            aria-label="Toggle background grid"
            onClick={
              handleGridToggle
            }
            className="
              relative
              h-5
              w-9
              shrink-0
              rounded-full
              p-0.5
              transition-colors
            "
            style={{
              backgroundColor:
                gridEnabled
                  ? selectedTheme.accent
                  : "rgba(100,116,139,0.35)",
            }}
          >
            <span
              className={`
                absolute
                top-0.5
                h-4
                w-4
                rounded-full
                bg-white
                shadow-sm
                transition-transform
                ${
                  gridEnabled
                    ? "translate-x-4"
                    : "translate-x-0"
                }
              `}
            />
          </button>
        </div>
      </div>

      {/* Current selection */}
      <div
        className="
          mt-4
          rounded-xl
          border
          px-3
          py-2.5
        "
        style={{
          borderColor:
            `color-mix(in srgb, ${selectedTheme.accent} 14%, transparent)`,
          backgroundColor:
            selectedTheme.accentSoft,
        }}
      >
        <p
          className="
            text-[9px]
            font-medium
            leading-4
          "
          style={{
            color:
              selectedTheme.muted,
          }}
        >
          Selected:{" "}
          <span
            style={{
              color:
                selectedTheme.text,
            }}
          >
            {selectedTheme.name}
          </span>

          {" · "}

          Grid{" "}
          {gridEnabled
            ? "on"
            : "off"}
        </p>
      </div>
    </section>
  )
}