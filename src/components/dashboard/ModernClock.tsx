import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"

// ======================================================
// CONFIG & TYPES
// ======================================================

const DEFAULT_BG_IMAGE = "/nature.jpg" // Put your nature photo as nature.jpg in /public folder

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
// STYLES FOR LEGIBILITY & HIGH CONTRAST
// ======================================================

const CSS_STYLES = `
  /* Tabular figures for non-jittery ticking */
  .tabular-clock {
    font-variant-numeric: tabular-nums;
  }

  /* Blinking colon animation */
  @keyframes colon-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }
  .animate-colon {
    animation: colon-pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Text stroke and contrast drop shadows */
  .contrast-text {
    text-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.85),
      0 2px 4px rgba(0, 0, 0, 0.75),
      0 0 35px rgba(0, 0, 0, 0.6);
  }

  /* Smooth background zoom on dynamic change */
  .bg-ambient-layer {
    transition: background-image 600ms ease-in-out;
  }
`

// ======================================================
// MAIN COMPONENT
// ======================================================

export function ModernClock() {
  const [now, setNow] = useState<Date>(() => new Date())
  const [hour12, setHour12] = useState<boolean>(true)
  const [selectedCity, setSelectedCity] = useState<CityConfig>(CITIES[0])
  const [bgImage, setBgImage] = useState<string>(DEFAULT_BG_IMAGE)
  const [highContrastOverlay, setHighContrastOverlay] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Ticking exactly on second boundary
  useEffect(() => {
    let timerId = 0
    const tick = () => {
      setNow(new Date())
      timerId = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    tick()
    return () => window.clearTimeout(timerId)
  }, [])

  // Calculate local time for selected timezone
  const timeInfo = useMemo(() => {
    return getZoneParts(selectedCity.zone, now)
  }, [selectedCity, now])

  // Format hours and minutes
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

  // Full date string (e.g. Wednesday, September 30)
  const formattedDate = `${timeInfo.weekday}, ${timeInfo.month} ${timeInfo.day}, ${timeInfo.year}`

  // Handle custom file upload for background image
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const imageUrl = URL.createObjectURL(file)
      setBgImage(imageUrl)
    }
  }

  return (
    <div className="relative flex h-screen w-full select-none items-center justify-center overflow-hidden bg-black font-sans text-white">
      <style>{CSS_STYLES}</style>

      {/* ====================================================== */}
      /* BACKGROUND IMAGE LAYER */
      {/* ====================================================== */}
      <div
        className="bg-ambient-layer absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: `url("${bgImage}")` }}
      >
        {/* Soft Vignette Overlay to enhance contrast around edges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60" />

        {/* Optional High Contrast Frosted Backdrop */}
        {highContrastOverlay && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-300" />
        )}
      </div>

      {/* ====================================================== */}
      /* MAIN CLOCK DISPLAY (MATCHING YOUR IMAGE) */
      {/* ====================================================== */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        {/* City & Country Tag */}
        <div className="mb-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-1.5 backdrop-blur-md shadow-lg">
          <span className="text-xl">{selectedCity.flag}</span>
          <span className="text-sm font-medium tracking-wide text-slate-200">
            {selectedCity.name}
          </span>
        </div>

        {/* Big Digital Clock Display */}
        <div className="contrast-text tabular-clock flex items-baseline justify-center font-bold tracking-tight">
          {/* Hours */}
          <span className="text-7xl sm:text-8xl md:text-[11rem] lg:text-[14rem] leading-none text-white">
            {clockDisplay.hours}
          </span>

          {/* Colon */}
          <span className="animate-colon mx-1 sm:mx-2 text-6xl sm:text-7xl md:text-[9rem] lg:text-[12rem] leading-none text-white/90">
            :
          </span>

          {/* Minutes */}
          <span className="text-7xl sm:text-8xl md:text-[11rem] lg:text-[14rem] leading-none text-white">
            {clockDisplay.minutes}
          </span>

          {/* AM / PM Suffix */}
          {clockDisplay.suffix && (
            <span className="ml-3 sm:ml-5 text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-semibold tracking-normal text-slate-200">
              {clockDisplay.suffix}
            </span>
          )}
        </div>

        {/* Date Display */}
        <p className="contrast-text mt-2 sm:mt-4 text-lg sm:text-xl md:text-2xl font-medium tracking-wide text-slate-200">
          {formattedDate}
        </p>
      </div>

      {/* ====================================================== */}
      /* FLOATING CONTROLS BAR (BOTTOM) */
      {/* ====================================================== */}
      <div className="absolute bottom-6 z-20 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-2.5 backdrop-blur-xl shadow-2xl transition-all hover:bg-black/60">
        {/* 12h / 24h Toggle Button */}
        <button
          type="button"
          onClick={() => setHour12(!hour12)}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
          title="Toggle 12h / 24h format"
        >
          {hour12 ? "12 Hour" : "24 Hour"}
        </button>

        <div className="h-4 w-[1px] bg-white/20" />

        {/* City Selector */}
        <div className="flex items-center gap-1">
          {CITIES.map((city) => (
            <button
              key={city.name}
              type="button"
              onClick={() => setSelectedCity(city)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedCity.name === city.name
                  ? "bg-white text-black shadow-md"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {city.name.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="h-4 w-[1px] bg-white/20" />

        {/* Custom Image Upload Button */}
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
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Custom Photo
        </button>

        <div className="h-4 w-[1px] bg-white/20" />

        {/* High Contrast Background Mask Toggle */}
        <button
          type="button"
          onClick={() => setHighContrastOverlay(!highContrastOverlay)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
            highContrastOverlay
              ? "bg-emerald-500/80 text-white"
              : "border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
          title="Toggle backdrop blur mask for intense backgrounds"
        >
          {highContrastOverlay ? "Blur Mask: ON" : "Blur Mask: OFF"}
        </button>
      </div>
    </div>
  )
}