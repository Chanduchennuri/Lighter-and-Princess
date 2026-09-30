import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"

// ======================================================
// CONFIG & TYPES
// ======================================================

const DEFAULT_BG_IMAGE = "/nature.jpg" // Place nature.jpg in /public folder
const STORAGE_KEY_CUSTOM_BG = "ambient_clock_custom_bg"

interface CityConfig {
  name: string
  zone: string
  country: string
  flag: string
}

const CITIES: CityConfig[] = [
  { name: "India (IST)", zone: "Asia/Kolkata", country: "India", flag: "🇮🇳" },
  { name: "New York", zone: "America/New_York", country: "USA", flag: "🇺🇸" },
  { name: "London", zone: "Europe/London", country: "UK", flag: "🇬🇧" },
  { name: "Dubai", zone: "Asia/Dubai", country: "UAE", flag: "🇦🇪" },
  { name: "Tokyo", zone: "Asia/Tokyo", country: "Japan", flag: "🇯🇵" },
]

// ======================================================
// TIME HELPERS
// ======================================================

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(zone: string) {
  let fmt = formatterCache.get(zone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
    formatterCache.set(zone, fmt)
  }
  return fmt
}

function getZoneParts(zone: string, date: Date) {
  const parts = getFormatter(zone).formatToParts(date)
  const find = (type: string) => parts.find((p) => p.type === type)?.value ?? ""

  return {
    hour: Number(find("hour")) % 24,
    minute: Number(find("minute")),
    second: Number(find("second")),
    weekday: find("weekday"),
    month: find("month"),
    day: find("day"),
    year: find("year"),
  }
}

const pad = (n: number) => String(n).padStart(2, "0")

// ======================================================
// STYLES & ANIMATIONS
// ======================================================

const CSS_STYLES = `
  /* Tabular figures for non-jittery ticking */
  .tabular-clock {
    font-variant-numeric: tabular-nums;
  }

  /* Static clock colon keeps rendering/compositor work minimal. */
  .clock-colon {
    opacity: 0.9;
  }

  /* Multi-layered drop shadows for contrast against any light/dark background */
  .contrast-text {
    text-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.85),
      0 2px 4px rgba(0, 0, 0, 0.75),
      0 0 25px rgba(0, 0, 0, 0.5);
  }

  /* Static background avoids unnecessary compositor work. */
  .bg-ambient-layer {
    contain: paint;
  }
`

// ======================================================
// MAIN COMPONENT
// ======================================================

export function ModernClock() {
  const [now, setNow] = useState<Date>(() => new Date())
  const [hour12, setHour12] = useState<boolean>(true)
  const [selectedCity, setSelectedCity] = useState<CityConfig>(CITIES[0])
  const [highContrastOverlay, setHighContrastOverlay] = useState<boolean>(false)
  
  // Persistent Custom Background Image state from localStorage
  const [bgImage, setBgImage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const savedBg = localStorage.getItem(STORAGE_KEY_CUSTOM_BG)
      if (savedBg) return savedBg
    }
    return DEFAULT_BG_IMAGE
  })

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Clock tick on second boundary
  useEffect(() => {
    let timerId = 0
    const tick = () => {
      setNow(new Date())
      timerId = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    tick()
    return () => window.clearTimeout(timerId)
  }, [])

  // Time zone calculations
  const timeInfo = useMemo(() => {
    return getZoneParts(selectedCity.zone, now)
  }, [selectedCity, now])

  // Formatted display values
  const clockDisplay = useMemo(() => {
    const rawHour = timeInfo.hour
    let hStr = ""
    let suffix = ""

    if (hour12) {
      const h12 = rawHour % 12 || 12
      hStr = pad(h12)
      suffix = rawHour >= 12 ? "PM" : "AM"
    } else {
      hStr = pad(rawHour)
      suffix = ""
    }

    return {
      hours: hStr,
      minutes: pad(timeInfo.minute),
      seconds: pad(timeInfo.second),
      suffix,
    }
  }, [timeInfo, hour12])

  const formattedDate = `${timeInfo.weekday}, ${timeInfo.month} ${timeInfo.day}, ${timeInfo.year}`

  // Keep the background style stable between one-second clock renders.
  const backgroundStyle = useMemo(
    () => ({ backgroundImage: `url("${bgImage}")` }),
    [bgImage],
  )

  // Persistent Custom Image Upload handler
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      try {
        const maxWidth = 1600
        const maxHeight = 1000
        const scale = Math.min(
          1,
          maxWidth / image.width,
          maxHeight / image.height,
        )

        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          throw new Error("Could not create image processing context.")
        }

        ctx.drawImage(image, 0, 0, width, height)

        // WebP keeps the saved background much smaller than raw camera PNGs/JPEGs.
        const compressed = canvas.toDataURL("image/webp", 0.8)

        setBgImage(compressed)

        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM_BG, compressed)
        } catch (err) {
          console.warn(
            "Storage limit exceeded for custom background image.",
            err,
          )
        }
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      console.warn("Could not load the selected background image.")
    }

    image.src = objectUrl
  }

  // Reset back to default nature image
  const handleResetDefaultBg = () => {
    setBgImage(DEFAULT_BG_IMAGE)
    localStorage.removeItem(STORAGE_KEY_CUSTOM_BG)
  }

  return (
    <div className="flex w-full items-center justify-center p-1 sm:p-2 font-sans text-white">
      <style>{CSS_STYLES}</style>

      {/* Rounded Ambient Container Card */}
      <div className="relative flex w-full max-w-3xl h-[360px] sm:h-[400px] md:h-[420px] flex-col items-center justify-between overflow-hidden rounded-3xl border border-white/20 bg-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] select-none p-4 sm:p-5 md:p-6">
        
        {/* Background Image Layer */}
        <div
          className="bg-ambient-layer absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
          style={backgroundStyle}
        >
          {/* Subtle Contrast Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60" />

          {/* High Contrast Blur Backdrop Mask */}
          {highContrastOverlay && (
            <div className="absolute inset-0 bg-black/45 transition-opacity duration-200" />
          )}
        </div>

        {/* Top Header & City Badge */}
        <div className="relative z-10 flex w-full items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 py-1.5 backdrop-blur-md shadow-md">
            <span className="text-lg">{selectedCity.flag}</span>
            <span className="text-xs sm:text-sm font-medium tracking-wide text-slate-100">
              {selectedCity.name}
            </span>
          </div>

          {/* Live Sync Status */}
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-semibold text-emerald-300">LIVE</span>
          </div>
        </div>

        {/* Center Digital Clock Readout (Sized Comfortably) */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center py-2">
          <div className="contrast-text tabular-clock flex items-baseline justify-center font-bold tracking-tight">
            {/* Hours */}
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl leading-none text-white">
              {clockDisplay.hours}
            </span>

            {/* Colon */}
            <span className="clock-colon mx-1 sm:mx-2 text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-none text-white/90">
              :
            </span>

            {/* Minutes */}
            <span className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl leading-none text-white">
              {clockDisplay.minutes}
            </span>

            {/* AM / PM Suffix */}
            {clockDisplay.suffix && (
              <span className="ml-2 sm:ml-4 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-normal text-slate-200">
                {clockDisplay.suffix}
              </span>
            )}
          </div>

          {/* Date */}
          <p className="contrast-text mt-3 text-sm sm:text-lg md:text-xl font-medium tracking-wide text-slate-200">
            {formattedDate}
          </p>
        </div>

        {/* Bottom Control Bar */}
        <div className="relative z-10 flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 backdrop-blur-xl shadow-2xl">
          {/* 12h / 24h Toggle */}
          <button
            type="button"
            onClick={() => setHour12(!hour12)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
            title="Toggle 12h / 24h format"
          >
            {hour12 ? "12h" : "24h"}
          </button>

          {/* City Selection Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            {CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedCity.name === city.name
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {city.name.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Controls: Custom Image & High Contrast Blur */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95"
              title="Upload photo (saved automatically in browser storage)"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload
            </button>

            {/* Reset Background button when custom photo is uploaded */}
            {bgImage !== DEFAULT_BG_IMAGE && (
              <button
                type="button"
                onClick={handleResetDefaultBg}
                className="rounded-lg border border-red-400/30 bg-red-500/20 px-2 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/30"
                title="Reset to default background"
              >
                Reset
              </button>
            )}

            {/* High-Contrast Blur Mask Toggle */}
            <button
              type="button"
              onClick={() => setHighContrastOverlay(!highContrastOverlay)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                highContrastOverlay
                  ? "bg-emerald-500/80 text-white shadow-sm"
                  : "border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
              title="Toggle backdrop blur mask"
            >
              Blur Mask
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}