import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Film,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Monitor,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import { useAnimationSelection, useTasks } from "../lib/appState"

import {
  filterAnimations,
  getAnimationById,
  getAnimationCategories,
  type AnimationItem,
  type AnimationMotion,
} from "../lib/animationLibrary"

/* ============================================================
   CONSTANTS
   ============================================================ */

const categories = getAnimationCategories()

type MediaFilter = "all" | "native" | "image" | "gif"
type SortMode = "library" | "name" | "category"
type ViewMode = "grid" | "list"
type Tone = "light" | "dark" | "checker" | "desktop"

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All media" },
  { id: "native", label: "Built-in motion" },
  { id: "image", label: "Images" },
  { id: "gif", label: "GIFs" },
]

const SORTS: { id: SortMode; label: string }[] = [
  { id: "library", label: "Library order" },
  { id: "name", label: "Name A to Z" },
  { id: "category", label: "Category" },
]

const MOTIONS: AnimationMotion[] = [
  "float",
  "bounce",
  "orbit",
  "pulse",
  "shake",
  "drift",
  "swing",
  "spin",
]

const TONES: { id: Tone; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "checker", label: "Transparent" },
  { id: "desktop", label: "Desktop" },
]

const MAX_RECENT = 6

/* ============================================================
   PHYSICS
   ------------------------------------------------------------
   Every preview is simulated, not keyframed:

   - Springs: damped harmonic oscillators
         x'' = -w^2 (x - target) - 2 z w x'
     integrated at a fixed 240 Hz step (frame-rate independent).
   - One shared requestAnimationFrame loop drives every visible
     preview, so 60 cards cost one frame callback, not 60.
   - Each motion (bounce, swing, shake...) is a small physical
     model: ballistic arc with impact squash, pendulum, damped
     impulse, layered noise, heartbeat, turntable inertia.
   ============================================================ */

const STEP = 1 / 240

class Spring {
  x: number
  v = 0

  constructor(x: number) {
    this.x = x
  }

  step(target: number, omega: number, zeta: number, dt: number) {
    const a = -omega * omega * (this.x - target) - 2 * zeta * omega * this.v
    this.v += a * dt
    this.x += this.v * dt
  }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/* ---------- shared scheduler ---------- */

type Tick = (dt: number) => boolean | void

const subscribers = new Set<Tick>()
let rafId = 0
let lastFrame = 0

function frame(now: number) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05)
  lastFrame = now

  for (const fn of Array.from(subscribers)) {
    if (fn(dt) === false) subscribers.delete(fn)
  }

  rafId = subscribers.size ? requestAnimationFrame(frame) : 0
}

function subscribe(fn: Tick) {
  subscribers.add(fn)

  if (!rafId) {
    lastFrame = performance.now()
    rafId = requestAnimationFrame(frame)
  }

  return () => {
    subscribers.delete(fn)
  }
}

/* ---------- motion models ---------- */

interface Sample {
  x: number // % of own width
  y: number // % of own height
  rot: number // degrees
  sx: number
  sy: number
}

const REST: Sample = { x: 0, y: 0, rot: 0, sx: 1, sy: 1 }

function sampleMotion(motion: AnimationMotion | null, t: number): Sample {
  switch (motion) {
    case "bounce": {
      // Ballistic hop: parabola, squash on impact, stretch at speed.
      const period = 1.15
      const u = (t % period) / period
      const height = 4 * u * (1 - u)
      const edge = Math.min(u, 1 - u)
      const squash = Math.exp(-edge * 22)
      const stretch = 0.07 * Math.abs(1 - 2 * u) * (1 - squash)

      const sy = 1 - 0.17 * squash + stretch
      const sx = 1 + 0.13 * squash - stretch * 0.5

      // Keep the feet planted while squashing.
      return { x: 0, y: -height * 16 + (1 - sy) * 50, rot: 0, sx, sy }
    }

    case "float":
      return {
        x: 1.6 * Math.sin(0.9 * t + 0.6),
        y: -3.2 * (Math.sin(1.3 * t) + 0.35 * Math.sin(2.9 * t + 1)),
        rot: 2.4 * Math.sin(1.1 * t),
        sx: 1,
        sy: 1,
      }

    case "orbit": {
      const w = 1.9
      return {
        x: 7 * Math.cos(w * t),
        y: 5 * Math.sin(w * t),
        rot: 4 * -Math.sin(w * t),
        sx: 1,
        sy: 1,
      }
    }

    case "pulse": {
      // Two-beat heartbeat envelope.
      const period = 1.6
      const u = (t % period) / period
      const f =
        Math.exp(-Math.pow((u - 0.12) / 0.055, 2)) +
        0.62 * Math.exp(-Math.pow((u - 0.34) / 0.07, 2))
      const s = 1 + 0.1 * f
      return { x: 0, y: 0, rot: 0, sx: s, sy: s }
    }

    case "shake": {
      // Damped impulse: a sharp rattle, then rest.
      const tau = t % 1.7
      const env = Math.exp(-6.5 * tau)
      return {
        x: 7 * env * Math.sin(58 * tau),
        y: 0,
        rot: 7 * env * Math.sin(52 * tau + 0.4),
        sx: 1,
        sy: 1,
      }
    }

    case "drift":
      return {
        x: 4.2 * (Math.sin(0.55 * t) + 0.6 * Math.sin(1.31 * t + 2)),
        y: 3.6 * (Math.sin(0.71 * t + 1) + 0.5 * Math.sin(1.77 * t)),
        rot: 3 * Math.sin(0.6 * t + 0.3),
        sx: 1,
        sy: 1,
      }

    case "swing": {
      // Pendulum about the base, with a touch of anharmonicity.
      const w = (2 * Math.PI) / 2.4
      return {
        x: 1.5 * Math.sin(w * t),
        y: 0,
        rot: 8 * Math.sin(w * t) * (1 + 0.08 * Math.sin(3 * w * t)),
        sx: 1,
        sy: 1,
      }
    }

    default:
      // "spin" is handled separately (needs inertia), null = static.
      return REST
  }
}

const originFor = (motion: AnimationMotion | null) =>
  motion === "swing" ? "50% 88%" : "50% 50%"

/* ---------- motion hook ---------- */

interface MotionOptions {
  motion: AnimationMotion | null
  active: boolean
  speed?: number
  interactive?: boolean
  enabled?: boolean
}

/**
 * Drives one element's transform from the shared loop.
 *
 *  - `active` eases motion in and out (amplitude spring), and the
 *    loop unsubscribes once the element has settled to rest.
 *  - `interactive` adds pointer parallax + 3D tilt springs, and a
 *    "poke" impulse on press.
 */
function useMotion<T extends HTMLElement>({
  motion,
  active,
  speed = 1,
  interactive = false,
  enabled = true,
}: MotionOptions) {
  const ref = useRef<T | null>(null)

  const activeRef = useRef(active)
  const speedRef = useRef(speed)
  const motionRef = useRef(motion)
  const interactiveRef = useRef(interactive)

  activeRef.current = active
  speedRef.current = speed
  motionRef.current = motion
  interactiveRef.current = interactive

  const state = useRef({
    t: Math.random() * 8,
    acc: 0,
    amp: new Spring(0),
    tiltX: new Spring(0),
    tiltY: new Spring(0),
    shiftX: new Spring(0),
    shiftY: new Spring(0),
    poke: new Spring(1),
    pokeRot: new Spring(0),
    angle: new Spring(0),
    angleTarget: 0,
    px: 0,
    py: 0,
  })

  const unsubRef = useRef<(() => void) | null>(null)

  const tick = useCallback((dt: number): boolean | void => {
    const el = ref.current
    const s = state.current

    if (!el) {
      unsubRef.current = null
      return false
    }

    const isActive = activeRef.current
    const inter = interactiveRef.current
    const spinning = motionRef.current === "spin"

    // Spin target keeps advancing while active; when released it
    // glides to the nearest full turn instead of freezing mid-rotation.
    if (spinning) {
      if (isActive) s.angleTarget += 58 * dt * speedRef.current
      else s.angleTarget = Math.round(s.angle.x / 360) * 360
    }

    s.acc += dt

    while (s.acc >= STEP) {
      s.acc -= STEP

      s.amp.step(isActive ? 1 : 0, 8, 1, STEP)
      s.tiltX.step(inter ? s.py * -11 : 0, 14, 0.7, STEP)
      s.tiltY.step(inter ? s.px * 13 : 0, 14, 0.7, STEP)
      s.shiftX.step(inter ? s.px * 4 : 0, 12, 0.8, STEP)
      s.shiftY.step(inter ? s.py * 3.5 : 0, 12, 0.8, STEP)
      s.poke.step(1, 24, 0.32, STEP)
      s.pokeRot.step(0, 20, 0.3, STEP)

      if (spinning) s.angle.step(s.angleTarget, 6, 1, STEP)
    }

    s.t += dt * speedRef.current

    const a = clamp(s.amp.x, 0, 1)
    const m = sampleMotion(spinning ? null : motionRef.current, s.t)

    const x = m.x * a + s.shiftX.x
    const y = m.y * a + s.shiftY.x
    const rot = m.rot * a + s.pokeRot.x + (spinning ? s.angle.x % 360 : 0)
    const sx = (1 + (m.sx - 1) * a) * s.poke.x
    const sy = (1 + (m.sy - 1) * a) * s.poke.x

    el.style.transform =
      `perspective(700px) rotateX(${s.tiltX.x.toFixed(2)}deg) rotateY(${s.tiltY.x.toFixed(2)}deg) ` +
      `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%) rotate(${rot.toFixed(2)}deg) ` +
      `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`

    // Fully at rest and nobody is interacting: stop costing frames.
    const settled =
      !isActive &&
      s.amp.x < 0.003 &&
      Math.abs(s.amp.v) < 0.01 &&
      Math.abs(s.tiltX.x) < 0.02 &&
      Math.abs(s.tiltY.x) < 0.02 &&
      Math.abs(s.shiftX.x) < 0.02 &&
      Math.abs(s.shiftY.x) < 0.02 &&
      Math.abs(s.poke.x - 1) < 0.002 &&
      Math.abs(s.pokeRot.x) < 0.02 &&
      (!spinning || Math.abs(s.angle.x - s.angleTarget) < 0.05)

    if (settled) {
      el.style.transform = ""
      unsubRef.current = null
      return false
    }
  }, [])

  const wake = useCallback(() => {
    if (unsubRef.current || !enabled || prefersReducedMotion()) return
    unsubRef.current = subscribe(tick)
  }, [enabled, tick])

  useEffect(() => {
    if (active) wake()
  }, [active, motion, wake])

  useEffect(() => {
    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [])

  const bind = interactive
    ? {
        onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
          const rect = event.currentTarget.getBoundingClientRect()
          state.current.px = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
          state.current.py = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
          wake()
        },
        onPointerLeave: () => {
          state.current.px = 0
          state.current.py = 0
          wake()
        },
        onPointerDown: () => {
          state.current.poke.v += 6
          state.current.pokeRot.v += (Math.random() < 0.5 ? -1 : 1) * 140
          wake()
        },
      }
    : {}

  return { ref, bind }
}

/** A number that springs to its target instead of snapping. */
function useSpringNumber(target: number) {
  const [value, setValue] = useState(target)
  const springRef = useRef(new Spring(target))

  useEffect(() => {
    if (prefersReducedMotion()) {
      springRef.current.x = target
      setValue(target)
      return
    }

    const spring = springRef.current
    let acc = 0

    const unsubscribe = subscribe((dt) => {
      acc += dt

      while (acc >= STEP) {
        acc -= STEP
        spring.step(target, 14, 0.8, STEP)
      }

      if (Math.abs(spring.x - target) < 0.01 && Math.abs(spring.v) < 0.01) {
        spring.x = target
        spring.v = 0
        setValue(target)
        return false
      }

      setValue(Math.round(spring.x))
    })

    return unsubscribe
  }, [target])

  return value
}

function AnimatedNumber({ value }: { value: number }) {
  return <>{useSpringNumber(value)}</>
}

/* ============================================================
   HELPERS
   ============================================================ */

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep in-memory only */
    }
  }, [key, value])

  return [value, setValue] as const
}

function mediaLabel(item: AnimationItem | null): string {
  if (!item) return "--"

  switch (item.mediaType) {
    case "gif":
      return "GIF"
    case "image":
      return "Image"
    default:
      return "Built-in"
  }
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

function stageStyle(tone: Tone): CSSProperties {
  switch (tone) {
    case "dark":
      return {
        background:
          "radial-gradient(circle at 50% 42%, #243049 0%, #131b2c 62%, #0b111d 100%)",
      }
    case "checker":
      return {
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(45deg,#e8ecf1 25%,transparent 25%,transparent 75%,#e8ecf1 75%)," +
          "linear-gradient(45deg,#e8ecf1 25%,transparent 25%,transparent 75%,#e8ecf1 75%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 10px 10px",
      }
    case "desktop":
      return {
        background:
          "linear-gradient(135deg,#dbeafe 0%,#e9d5ff 48%,#fde2e4 100%)",
      }
    default:
      return {
        background:
          "radial-gradient(circle at center, #ffffff 0%, #f6f7f9 68%, #eef1f4 100%)",
      }
  }
}

interface FilterState {
  category: string
  media: MediaFilter
  motion: AnimationMotion | "any"
  favoritesOnly: boolean
}

function matches(
  item: AnimationItem,
  filters: FilterState,
  favorites: Set<string>,
  skip?: "category" | "media",
) {
  if (skip !== "category" && filters.category !== "All" && item.category !== filters.category)
    return false

  if (skip !== "media" && filters.media !== "all" && item.mediaType !== filters.media)
    return false

  if (filters.motion !== "any" && item.motion !== filters.motion) return false
  if (filters.favoritesOnly && !favorites.has(item.id)) return false

  return true
}

/* ============================================================
   STYLES
   ============================================================ */

const CSS = `
  @keyframes gl-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .gl-card-in {
    animation: gl-card-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--d, 0ms);
  }

  @keyframes gl-modal {
    0%   { opacity: 0; transform: translateY(20px) scale(0.955); }
    100% { opacity: 1; transform: none; }
  }
  .gl-modal { animation: gl-modal 440ms cubic-bezier(0.22, 1.2, 0.36, 1) both; }

  @keyframes gl-fade { from { opacity: 0; } to { opacity: 1; } }
  .gl-fade { animation: gl-fade 220ms ease both; }

  @keyframes gl-toast {
    from { opacity: 0; transform: translate(-50%, 16px) scale(0.96); }
    to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
  }
  .gl-toast { animation: gl-toast 360ms cubic-bezier(0.22, 1.2, 0.36, 1) both; }

  @keyframes gl-heart {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.35); }
    100% { transform: scale(1); }
  }
  .gl-heart-pop { animation: gl-heart 380ms cubic-bezier(0.22, 1.2, 0.36, 1); }

  @keyframes gl-ripple {
    0%   { transform: scale(0.7); opacity: 0; }
    20%  { opacity: 0.5; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  .gl-ripple {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 110px;
    height: 110px;
    margin: -55px 0 0 -55px;
    border-radius: 9999px;
    border: 2px solid rgba(23, 32, 51, 0.35);
    pointer-events: none;
    animation: gl-ripple 2.8s cubic-bezier(0.16, 0.6, 0.3, 1) infinite;
  }
  .gl-ripple-2 { animation-delay: 1.4s; }

  @keyframes gl-pop {
    from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.94); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  .gl-pop { animation: gl-pop 320ms cubic-bezier(0.22, 1.2, 0.36, 1) both; }

  /* Cursor sheen across a card's visual. */
  .gl-sheen::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 240ms ease;
    background: radial-gradient(
      200px circle at var(--mx, 50%) var(--my, 50%),
      rgba(255, 255, 255, 0.75),
      transparent 70%
    );
  }
  .gl-sheen:hover::after { opacity: 1; }

  .gl-range {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 9999px;
    background: #e2e8f0;
    outline: none;
  }
  .gl-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 9999px;
    background: #172033;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(23, 32, 51, 0.35);
    cursor: pointer;
  }
  .gl-range::-moz-range-thumb {
    height: 14px;
    width: 14px;
    border-radius: 9999px;
    background: #172033;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(23, 32, 51, 0.35);
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .gl-card-in, .gl-modal, .gl-fade, .gl-toast, .gl-heart-pop, .gl-pop { animation: none; }
    .gl-ripple { animation: none; opacity: 0; }
  }
`

/* ============================================================
   GALLERY
   ============================================================ */

interface ToastState {
  id: number
  message: string
  onUndo?: () => void
}

export function Gallery() {
  const { selectedAnimationId, setSelectedAnimationId, selectedAnimationExists } =
    useAnimationSelection()

  const { tasks } = useTasks()

  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all")
  const [motionFilter, setMotionFilter] = useState<AnimationMotion | "any">("any")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>("library")

  const [view, setView] = usePersistentState<ViewMode>("lp.gallery.view", "grid")
  const [animateAll, setAnimateAll] = usePersistentState<boolean>("lp.gallery.animateAll", false)
  const [favoriteIds, setFavoriteIds] = usePersistentState<string[]>("lp.gallery.favorites", [])
  const [recentIds, setRecentIds] = usePersistentState<string[]>("lp.gallery.recent", [])

  const [tone, setTone] = useState<Tone>("light")
  const [speed, setSpeed] = useState(1)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [inspectId, setInspectId] = useState<string | null>(null)
  const [roveId, setRoveId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const searchRef = useRef<HTMLInputElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const inspectTimer = useRef<number | null>(null)

  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds])

  /* ----------------------------------------------------------
     FILTERING + SORTING
     ---------------------------------------------------------- */

  const filters: FilterState = {
    category,
    media: mediaFilter,
    motion: motionFilter,
    favoritesOnly,
  }

  const searched = useMemo(() => filterAnimations(search, "All"), [search])

  const filteredItems = useMemo(() => {
    const base = filterAnimations(search, category).filter((item) =>
      matches(item, { category, media: mediaFilter, motion: motionFilter, favoritesOnly }, favorites),
    )

    if (sort === "name") return [...base].sort((a, b) => a.name.localeCompare(b.name))

    if (sort === "category")
      return [...base].sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      )

    return base
  }, [search, category, mediaFilter, motionFilter, favoritesOnly, favorites, sort])

  // Counts shown on the chips, respecting every other active filter.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const name of categories) {
      counts[name] = searched.filter(
        (item) =>
          (name === "All" || item.category === name) &&
          matches(item, filters, favorites, "category"),
      ).length
    }

    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, mediaFilter, motionFilter, favoritesOnly, favorites])

  const mediaCounts = useMemo(() => {
    const counts: Record<MediaFilter, number> = { all: 0, native: 0, image: 0, gif: 0 }

    for (const item of searched) {
      if (!matches(item, filters, favorites, "media")) continue
      counts.all += 1
      counts[item.mediaType] += 1
    }

    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, category, motionFilter, favoritesOnly, favorites])

  const totalCount = useMemo(() => filterAnimations("", "All").length, [])


  /* ----------------------------------------------------------
     SELECTION + INSPECTION
     ---------------------------------------------------------- */

  const selectedAnimation = getAnimationById(selectedAnimationId)
  const previewAnimation = getAnimationById(previewId)

  // The side panel follows whatever you hover or focus.
  const inspected = getAnimationById(inspectId) ?? selectedAnimation
  const inspectingOther = inspected !== null && inspected.id !== selectedAnimation?.id

  const usageById = useMemo(() => {
    const map = new Map<string, number>()

    for (const task of tasks) {
      map.set(task.animation_id, (map.get(task.animation_id) ?? 0) + 1)
    }

    return map
  }, [tasks])

  const inspectedTasks = useMemo(
    () => (inspected ? tasks.filter((task) => task.animation_id === inspected.id) : []),
    [tasks, inspected],
  )

  const usageCount = selectedAnimation ? (usageById.get(selectedAnimation.id) ?? 0) : 0

  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => getAnimationById(id))
        .filter((item): item is AnimationItem => item !== null),
    [recentIds],
  )

  /* ----------------------------------------------------------
     TOAST
     ---------------------------------------------------------- */

  function showToast(message: string, onUndo?: () => void) {
    setToast({ id: Date.now(), message, onUndo })
  }

  useEffect(() => {
    if (!toast) return

    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  /* ----------------------------------------------------------
     ACTIONS
     ---------------------------------------------------------- */

  function selectAnimation(item: AnimationItem) {
    if (item.id === selectedAnimationId) {
      showToast(`${item.name} is already the default`)
      return
    }

    const previous = selectedAnimationId

    setSelectedAnimationId(item.id)

    setRecentIds((ids) => [item.id, ...ids.filter((id) => id !== item.id)].slice(0, MAX_RECENT))

    showToast(
      `${item.name} is now the default for new tasks`,
      previous ? () => setSelectedAnimationId(previous) : undefined,
    )
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function resetFilters() {
    setSearch("")
    setCategory("All")
    setMediaFilter("all")
    setMotionFilter("any")
    setFavoritesOnly(false)
    setSort("library")
    setInspectId(null)
  }

  function surprise() {
    if (filteredItems.length === 0) return

    const pick = filteredItems[Math.floor(Math.random() * filteredItems.length)]

    setInspectId(pick.id)
    setPreviewId(pick.id)
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      showToast("Animation ID copied")
    } catch {
      showToast("Could not copy the ID")
    }
  }

  function inspectSoon(id: string) {
    if (inspectTimer.current) window.clearTimeout(inspectTimer.current)

    inspectTimer.current = window.setTimeout(() => setInspectId(id), 140)
  }

  function cancelInspect() {
    if (inspectTimer.current) window.clearTimeout(inspectTimer.current)
  }

  useEffect(() => () => cancelInspect(), [])

  /* ----------------------------------------------------------
     KEYBOARD
     "/" focuses search. Inside the library:
     arrows move, Enter selects, Space previews, F favorites.
     ---------------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null

      if (target?.closest("input, textarea, select, [contenteditable='true']")) return
      if (previewId) return

      event.preventDefault()
      searchRef.current?.focus()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [previewId])

  function focusCard(id: string) {
    const el = cardRefs.current.get(id)

    el?.focus()
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }

  function findVertical(index: number, direction: 1 | -1) {
    const current = cardRefs.current.get(filteredItems[index].id)

    if (!current) return -1

    const from = current.getBoundingClientRect()

    let best = -1
    let bestDy = Infinity
    let bestDx = Infinity

    filteredItems.forEach((item, j) => {
      if (j === index) return

      const el = cardRefs.current.get(item.id)

      if (!el) return

      const rect = el.getBoundingClientRect()
      const dy = (rect.top - from.top) * direction

      if (dy < 8) return

      const dx = Math.abs(rect.left - from.left)

      if (dy < bestDy - 4 || (Math.abs(dy - bestDy) <= 4 && dx < bestDx)) {
        best = j
        bestDy = dy
        bestDx = dx
      }
    })

    return best
  }

  function handleGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-card-id]")

    if (!target) return

    const index = filteredItems.findIndex((item) => item.id === target.dataset.cardId)

    if (index < 0) return

    const item = filteredItems[index]

    let next = -1

    switch (event.key) {
      case "ArrowRight":
        next = index + 1
        break
      case "ArrowLeft":
        next = index - 1
        break
      case "ArrowDown":
        next = view === "list" ? index + 1 : findVertical(index, 1)
        break
      case "ArrowUp":
        next = view === "list" ? index - 1 : findVertical(index, -1)
        break
      case "Home":
        next = 0
        break
      case "End":
        next = filteredItems.length - 1
        break
      case "Enter":
        event.preventDefault()
        selectAnimation(item)
        return
      case " ":
        event.preventDefault()
        setPreviewId(item.id)
        return
      case "f":
      case "F":
        event.preventDefault()
        toggleFavorite(item.id)
        return
      default:
        return
    }

    event.preventDefault()

    if (next >= 0 && next < filteredItems.length) focusCard(filteredItems[next].id)
  }

  // Roving tabindex target: the last focused card, else the first.
  const activeRove =
    roveId && filteredItems.some((item) => item.id === roveId) ? roveId : filteredItems[0]?.id

  /* ----------------------------------------------------------
     PREVIEW NAVIGATION
     ---------------------------------------------------------- */

  const previewIndex = previewAnimation
    ? filteredItems.findIndex((item) => item.id === previewAnimation.id)
    : -1

  function stepPreview(delta: number) {
    if (filteredItems.length === 0) return

    const base = previewIndex < 0 ? 0 : previewIndex
    const next = (base + delta + filteredItems.length) % filteredItems.length

    setPreviewId(filteredItems[next].id)
  }

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      <style>{CSS}</style>

      <div className="px-5 py-6 md:px-7 md:py-7">
        {/* HEADER */}

        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <Sparkles size={18} strokeWidth={1.8} className="text-slate-400" />

            <span className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-slate-400">
              L&P Animation Library
            </span>
          </div>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="font-serif text-[46px] font-bold italic leading-none tracking-[-0.045em] text-[#172033] md:text-[54px]">
                Gallery
              </h1>

              <p className="mt-3 max-w-2xl text-[16px] font-medium leading-6 text-slate-400">
                Choose the visual that appears when a reminder fires. Built-in motion, images, and
                GIFs all use the same animation ID pipeline.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[320px]">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                />

                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearch("")
                      event.currentTarget.blur()
                    }
                  }}
                  placeholder="Search characters, cars, space, nature..."
                  aria-label="Search animations"
                  className="h-12 w-full rounded-[14px] border border-slate-200 bg-white pl-11 pr-12 text-[14px] font-medium text-slate-600 outline-none transition placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                />

                {search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-400">
                    /
                  </kbd>
                )}
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-500 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* ACTIVE SELECTION */}

        <section className="mt-6 rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(30,45,65,0.04)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50 shadow-inner">
                <AnimatedVisual
                  item={selectedAnimation}
                  className="h-full w-full text-[42px]"
                  active
                  plate={false}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#172033] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                    Selected
                  </span>

                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-600">
                    Saved
                  </span>
                </div>

                <h2 className="mt-2 truncate text-[23px] font-bold tracking-[-0.03em] text-[#172033]">
                  {selectedAnimation?.name ?? "Default animation"}
                </h2>

                <p className="mt-1 truncate text-[14px] font-medium text-slate-400">
                  {selectedAnimation?.description ?? "Choose an animation from the library."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[440px]">
              <Stat label="Library">
                <AnimatedNumber value={totalCount} />
              </Stat>

              <Stat label="Favorites">
                <AnimatedNumber value={favoriteIds.length} />
              </Stat>

              <Stat label="Tasks using it">
                <AnimatedNumber value={usageCount} />
              </Stat>

              <Stat label="Mode">
                {selectedAnimation?.mediaType === "gif"
                  ? "GIF"
                  : selectedAnimation?.mediaType === "image"
                    ? "Image"
                    : "Motion"}
              </Stat>
            </div>
          </div>

          {!selectedAnimationExists && (
            <div className="mt-4 rounded-[14px] border border-amber-100 bg-amber-50 px-4 py-3 text-[14px] font-medium text-amber-700">
              The saved animation ID is not available in the current library. Select another
              animation to restore a valid choice.
            </div>
          )}

          {/* RECENT */}

          {recentItems.length > 1 && (
            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
              <span className="text-[12px] font-semibold text-slate-400">Recently used</span>

              <div className="flex items-center gap-2">
                {recentItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.name}
                    aria-label={`Preview ${item.name}`}
                    onClick={() => setInspectId(item.id)}
                    onDoubleClick={() => selectAnimation(item)}
                    className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-[11px] border bg-slate-50 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 active:scale-95 ${
                      item.id === selectedAnimationId
                        ? "border-[#172033] ring-2 ring-slate-100"
                        : "border-slate-200"
                    }`}
                  >
                    <AnimatedVisual
                      item={item}
                      className="h-full w-full text-[22px]"
                      active={false}
                      plate={false}
                    />
                  </button>
                ))}
              </div>

              <span className="hidden text-[12px] font-medium text-slate-300 sm:inline">
                Double-click to reuse
              </span>
            </div>
          )}
        </section>

        {/* FILTERS */}

        <section className="mt-6 flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => {
                const active = category === item
                const count = categoryCounts[item] ?? 0

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={active}
                    className={`shrink-0 rounded-full border px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.1em] transition active:scale-95 ${
                      active
                        ? "border-[#172033] bg-[#172033] text-white"
                        : count === 0
                          ? "border-slate-100 bg-white text-slate-300"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#172033]"
                    }`}
                  >
                    {item}
                    <span className={`ml-2 ${active ? "opacity-60" : "opacity-50"}`}>{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {MEDIA_FILTERS.map(({ id, label }) => {
                const active = mediaFilter === id

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMediaFilter(id)}
                    aria-pressed={active}
                    className={`shrink-0 rounded-[12px] border px-3.5 py-2.5 text-[12px] font-bold transition active:scale-95 ${
                      active
                        ? "border-slate-300 bg-slate-100 text-[#172033]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 opacity-50">{mediaCounts[id]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* TOOLBAR */}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-200/80 bg-white px-4 py-3">
            <p className="text-[13px] font-semibold text-slate-500" aria-live="polite">
              <span className="text-[#172033]">{filteredItems.length}</span> of {totalCount}{" "}
              animations
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Favorites */}
              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((v) => !v)}
                className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-[12px] font-bold transition active:scale-95 ${
                  favoritesOnly
                    ? "border-red-200 bg-red-50 text-red-500"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                <Heart size={14} fill={favoritesOnly ? "currentColor" : "none"} />
                Favorites
              </button>

              {/* Motion */}
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-400">
                Motion
                <select
                  value={motionFilter}
                  onChange={(event) => setMotionFilter(event.target.value as AnimationMotion | "any")}
                  className="h-9 rounded-[10px] border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600 outline-none transition focus:border-slate-400"
                >
                  <option value="any">Any</option>
                  {MOTIONS.map((motion) => (
                    <option key={motion} value={motion}>
                      {capitalize(motion)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Sort */}
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-400">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  className="h-9 rounded-[10px] border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600 outline-none transition focus:border-slate-400"
                >
                  {SORTS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Animate all */}
              <button
                type="button"
                role="switch"
                aria-checked={animateAll}
                onClick={() => setAnimateAll((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-500 transition hover:border-slate-300 active:scale-95"
              >
                <span
                  className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${
                    animateAll ? "bg-[#172033]" : "bg-slate-200"
                  }`}
                >
                  <span
                    className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200"
                    style={{ left: animateAll ? "14px" : "2px" }}
                  />
                </span>
                Animate all
              </button>

              {/* Surprise */}
              <button
                type="button"
                onClick={surprise}
                disabled={filteredItems.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-500 transition hover:border-slate-300 hover:text-[#172033] active:scale-95 disabled:opacity-40"
              >
                <Shuffle size={14} />
                Surprise me
              </button>

              {/* View */}
              <div
                role="group"
                aria-label="Layout"
                className="inline-flex rounded-[10px] border border-slate-200 bg-slate-50 p-0.5"
              >
                {(
                  [
                    ["grid", <LayoutGrid key="g" size={15} />, "Grid view"],
                    ["list", <List key="l" size={15} />, "List view"],
                  ] as const
                ).map(([mode, icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-label={label}
                    aria-pressed={view === mode}
                    onClick={() => setView(mode)}
                    className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-all duration-200 ${
                      view === mode
                        ? "bg-[#172033] text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-700"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* BODY */}

        <section className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          {/* LIBRARY */}

          <div className="min-w-0">
            {filteredItems.length === 0 ? (
              <EmptyGallery
                onReset={resetFilters}
                favoritesOnly={favoritesOnly && favoriteIds.length === 0}
              />
            ) : (
              <div
                role="list"
                aria-label="Animation library"
                onKeyDown={handleGridKeyDown}
                className={
                  view === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3"
                    : "flex flex-col gap-2.5"
                }
              >
                {filteredItems.map((item, index) => {
                  const shared = {
                    item,
                    index,
                    selected: item.id === selectedAnimationId,
                    inspected: item.id === inspected?.id,
                    favorite: favorites.has(item.id),
                    usage: usageById.get(item.id) ?? 0,
                    focusable: item.id === activeRove,
                    animateAll,
                    registerRef: (el: HTMLButtonElement | null) => {
                      if (el) cardRefs.current.set(item.id, el)
                      else cardRefs.current.delete(item.id)
                    },
                    onInspect: () => {
                      cancelInspect()
                      setInspectId(item.id)
                    },
                    onInspectSoon: () => inspectSoon(item.id),
                    onCancelInspect: cancelInspect,
                    onFocusCard: () => {
                      setRoveId(item.id)
                      setInspectId(item.id)
                    },
                    onSelect: () => selectAnimation(item),
                    onPreview: () => setPreviewId(item.id),
                    onToggleFavorite: () => toggleFavorite(item.id),
                  }

                  return view === "grid" ? (
                    <AnimationCard key={item.id} {...shared} />
                  ) : (
                    <AnimationRow key={item.id} {...shared} />
                  )
                })}
              </div>
            )}

            {filteredItems.length > 0 && (
              <p className="mt-5 hidden text-[12px] font-medium text-slate-400 md:block">
                Arrow keys move, Enter selects, Space previews, F favorites, / searches.
              </p>
            )}
          </div>

          {/* INSPECTOR */}

          <aside className="h-fit rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(30,45,65,0.05)] xl:sticky xl:top-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  {inspectingOther ? "Previewing" : "Live Preview"}
                </p>

                <h2 className="mt-2 truncate text-[24px] font-bold tracking-[-0.03em] text-[#172033]">
                  {inspected?.name ?? "No selection"}
                </h2>
              </div>

              {inspectingOther ? (
                <button
                  type="button"
                  onClick={() => setInspectId(null)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
                >
                  Back to selected
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-600">
                  Ready
                </span>
              )}
            </div>

            {/* STAGE */}

            <div
              className="mt-5 aspect-square overflow-hidden rounded-[22px] border border-slate-200"
              style={stageStyle(tone)}
            >
              <AnimatedVisual
                item={inspected}
                className="h-full w-full text-[104px]"
                active
                interactive
                large
                speed={speed}
                tone={tone}
                plate={false}
              />
            </div>

            <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
              Move over the stage to tilt it. Click to poke it.
            </p>

            <StageControls tone={tone} onTone={setTone} speed={speed} onSpeed={setSpeed} />

            <p className="mt-4 text-[14px] font-medium leading-6 text-slate-500">
              {inspected?.description ?? "Select a library item to preview it here."}
            </p>

            {/* TAGS */}

            {inspected && inspected.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from(new Set(inspected.tags.map((tag) => tag.toLowerCase())))
                  .slice(0, 8)
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSearch(tag)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-[#172033] active:scale-95"
                    >
                      {tag}
                    </button>
                  ))}
              </div>
            )}

            <div className="mt-5 space-y-2">
              <InfoRow
                icon={
                  inspected?.mediaType === "native" ? (
                    <Sparkles size={15} />
                  ) : inspected?.mediaType === "gif" ? (
                    <Film size={15} />
                  ) : (
                    <ImageIcon size={15} />
                  )
                }
                label="Type"
                value={mediaLabel(inspected)}
              />

              <InfoRow
                icon={<Sparkles size={15} />}
                label="Motion"
                value={inspected?.motion ? capitalize(inspected.motion) : "Static"}
              />

              <InfoRow
                icon={<Copy size={15} />}
                label="ID"
                value={inspected?.id ?? "--"}
                onClick={inspected ? () => void copyId(inspected.id) : undefined}
                hint="Click to copy"
              />
            </div>

            {/* USED BY */}

            {inspected && (
              <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[12px] font-semibold text-slate-400">
                  Used by {inspectedTasks.length} {inspectedTasks.length === 1 ? "task" : "tasks"}
                </p>

                {inspectedTasks.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {inspectedTasks.slice(0, 3).map((task) => (
                      <li key={task.id} className="truncate text-[13px] font-semibold text-slate-600">
                        {task.title}
                      </li>
                    ))}

                    {inspectedTasks.length > 3 && (
                      <li className="text-[12px] font-medium text-slate-400">
                        +{inspectedTasks.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => inspected && setPreviewId(inspected.id)}
              disabled={!inspected}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-[#172033] text-[14px] font-bold text-white transition hover:bg-[#243049] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={17} fill="currentColor" />
              Open Full Preview
            </button>

            <button
              type="button"
              onClick={() => inspected && selectAnimation(inspected)}
              disabled={!inspected}
              className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-slate-200 bg-white text-[14px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-[#172033] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={17} />
              {inspected && inspected.id === selectedAnimationId
                ? "Selected for New Tasks"
                : "Use for New Tasks"}
            </button>
          </aside>
        </section>

        {previewAnimation && (
          <PreviewModal
            item={previewAnimation}
            position={previewIndex >= 0 ? `${previewIndex + 1} of ${filteredItems.length}` : null}
            selected={previewAnimation.id === selectedAnimationId}
            favorite={favorites.has(previewAnimation.id)}
            tone={tone}
            onTone={setTone}
            speed={speed}
            onSpeed={setSpeed}
            onSelect={() => selectAnimation(previewAnimation)}
            onToggleFavorite={() => toggleFavorite(previewAnimation.id)}
            onStep={stepPreview}
            onClose={() => setPreviewId(null)}
          />
        )}

        {/* TOAST */}

        {toast && (
          <div
            key={toast.id}
            role="status"
            className="gl-toast fixed bottom-6 left-1/2 z-[10010] flex max-w-[92vw] items-center gap-4 rounded-[14px] bg-[#172033] py-3 pl-5 pr-3 text-white shadow-[0_18px_44px_rgba(15,23,42,0.32)]"
          >
            <span className="text-[14px] font-semibold">{toast.message}</span>

            {toast.onUndo && (
              <button
                type="button"
                onClick={() => {
                  toast.onUndo?.()
                  setToast(null)
                }}
                className="rounded-[9px] bg-white/10 px-3 py-1.5 text-[13px] font-bold transition hover:bg-white/20 active:scale-95"
              >
                Undo
              </button>
            )}

            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/* ============================================================
   STAGE CONTROLS (background + speed)
   ============================================================ */

function StageControls({
  tone,
  onTone,
  speed,
  onSpeed,
}: {
  tone: Tone
  onTone: (tone: Tone) => void
  speed: number
  onSpeed: (speed: number) => void
}) {
  return (
    <div className="mt-3 space-y-3">
      <div role="group" aria-label="Preview background" className="grid grid-cols-4 gap-1.5">
        {TONES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={tone === option.id}
            onClick={() => onTone(option.id)}
            className={`flex flex-col items-center gap-1.5 rounded-[11px] border px-1 py-2 text-[11px] font-bold transition active:scale-95 ${
              tone === option.id
                ? "border-[#172033] text-[#172033]"
                : "border-slate-200 text-slate-400 hover:border-slate-300"
            }`}
          >
            <span
              className="h-5 w-full max-w-[42px] rounded-md border border-slate-200"
              style={stageStyle(option.id)}
            />
            {option.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-[12px] font-semibold text-slate-400">Speed</span>

        <input
          type="range"
          min={0.25}
          max={2}
          step={0.05}
          value={speed}
          onChange={(event) => onSpeed(Number(event.target.value))}
          aria-label="Preview speed"
          className="gl-range w-full"
        />

        <span
          className="w-10 shrink-0 text-right font-mono text-[12px] font-bold text-slate-500"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {speed.toFixed(2)}×
        </span>
      </label>
    </div>
  )
}

/* ============================================================
   ANIMATION CARD (grid)
   ============================================================ */

interface CardProps {
  item: AnimationItem
  index: number
  selected: boolean
  inspected: boolean
  favorite: boolean
  usage: number
  focusable: boolean
  animateAll: boolean
  registerRef: (el: HTMLButtonElement | null) => void
  onInspect: () => void
  onInspectSoon: () => void
  onCancelInspect: () => void
  onFocusCard: () => void
  onSelect: () => void
  onPreview: () => void
  onToggleFavorite: () => void
}

/** Hover / focus / visibility state shared by cards and rows. */
function useCardActivity(animateAll: boolean, selected: boolean) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Only pay for the observer while "Animate all" is on.
  useEffect(() => {
    if (!animateAll) {
      setVisible(false)
      return
    }

    const el = rootRef.current

    if (!el) return

    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "80px",
    })

    observer.observe(el)

    return () => observer.disconnect()
  }, [animateAll])

  return {
    rootRef,
    setHovered,
    setFocused,
    active: hovered || focused || selected || (animateAll && visible),
  }
}

function HeartButton({
  favorite,
  name,
  onToggle,
}: {
  favorite: boolean
  name: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      aria-pressed={favorite}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 ${
        favorite ? "text-red-500" : "text-slate-400 hover:text-slate-700"
      }`}
    >
      <Heart
        key={String(favorite)}
        size={15}
        fill={favorite ? "currentColor" : "none"}
        className={favorite ? "gl-heart-pop" : ""}
      />
    </button>
  )
}

function AnimationCard(props: CardProps) {
  const {
    item,
    index,
    selected,
    inspected,
    favorite,
    usage,
    focusable,
    animateAll,
    registerRef,
    onInspect,
    onInspectSoon,
    onCancelInspect,
    onFocusCard,
    onSelect,
    onPreview,
    onToggleFavorite,
  } = props

  const { rootRef, setHovered, setFocused, active } = useCardActivity(animateAll, selected)

  return (
    <div
      ref={rootRef}
      role="listitem"
      onPointerEnter={() => {
        setHovered(true)
        onInspectSoon()
      }}
      onPointerLeave={() => {
        setHovered(false)
        onCancelInspect()
      }}
      style={
        {
          "--d": `${Math.min(index, 14) * 30}ms`,
          contentVisibility: "auto",
          containIntrinsicSize: "auto 380px",
        } as CSSProperties
      }
      className={`gl-card-in group relative overflow-hidden rounded-[21px] border bg-white p-3.5 text-left shadow-[0_5px_20px_rgba(30,45,65,0.035)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(30,45,65,0.08)] ${
        selected
          ? "border-[#172033] ring-2 ring-slate-100"
          : inspected
            ? "border-slate-300"
            : "border-slate-200"
      }`}
    >
      <div
        className="gl-sheen relative overflow-hidden rounded-[16px] border border-slate-100 bg-slate-50"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`)
          event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`)
        }}
      >
        <AnimatedVisual
          item={item}
          className="h-[190px] w-full text-[82px] sm:h-[210px]"
          active={active}
        />

        {/* Primary focus target: the whole visual */}
        <button
          ref={registerRef}
          type="button"
          data-card-id={item.id}
          tabIndex={focusable ? 0 : -1}
          onClick={() => {
            onSelect()
            onInspect()
          }}
          onFocus={() => {
            setFocused(true)
            onFocusCard()
          }}
          onBlur={() => setFocused(false)}
          aria-label={`${item.name}, ${item.category}${selected ? ", selected" : ""}`}
          className="absolute inset-0 z-[1] rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#172033]"
        />

        {selected && (
          <div className="pointer-events-none absolute left-3 top-3 z-[2] flex items-center gap-1.5 rounded-full bg-[#172033] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-lg">
            <Check size={13} />
            Selected
          </div>
        )}

        {usage > 0 && !selected && (
          <div className="pointer-events-none absolute left-3 top-3 z-[2] rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow backdrop-blur">
            {usage} {usage === 1 ? "task" : "tasks"}
          </div>
        )}

        <div className="absolute right-3 top-3 z-[2]">
          <HeartButton favorite={favorite} name={item.name} onToggle={onToggleFavorite} />
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onPreview()
          }}
          className="absolute bottom-3 right-3 z-[2] flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#172033] shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white active:scale-95"
          aria-label={`Preview ${item.name}`}
        >
          <Play size={15} fill="currentColor" />
        </button>
      </div>

      <div className="px-1 pt-4">
        <h3 className="truncate text-[20px] font-bold tracking-[-0.025em] text-[#172033]">
          {item.name}
        </h3>

        <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          {item.category} · {mediaLabel(item)}
        </p>

        <p className="mt-2 line-clamp-2 text-[14px] font-medium leading-5 text-slate-400">
          {item.description}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onSelect}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[11px] text-[13px] font-bold transition active:scale-[0.98] ${
              selected
                ? "bg-[#172033] text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#172033]"
            }`}
          >
            <Check size={15} />
            {selected ? "Selected" : "Select"}
          </button>

          <div className="flex h-11 items-center rounded-[11px] border border-slate-200 bg-slate-50 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {item.motion}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   ANIMATION ROW (list view)
   ============================================================ */

function AnimationRow(props: CardProps) {
  const {
    item,
    index,
    selected,
    inspected,
    favorite,
    usage,
    focusable,
    animateAll,
    registerRef,
    onInspect,
    onInspectSoon,
    onCancelInspect,
    onFocusCard,
    onSelect,
    onPreview,
    onToggleFavorite,
  } = props

  const { rootRef, setHovered, setFocused, active } = useCardActivity(animateAll, selected)

  return (
    <div
      ref={rootRef}
      role="listitem"
      onPointerEnter={() => {
        setHovered(true)
        onInspectSoon()
      }}
      onPointerLeave={() => {
        setHovered(false)
        onCancelInspect()
      }}
      style={{ "--d": `${Math.min(index, 14) * 25}ms` } as CSSProperties}
      className={`gl-card-in group flex items-center gap-4 rounded-[18px] border bg-white p-3 transition-all duration-200 hover:border-slate-300 hover:shadow-[0_10px_25px_rgba(30,45,65,0.06)] ${
        selected
          ? "border-[#172033] ring-2 ring-slate-100"
          : inspected
            ? "border-slate-300"
            : "border-slate-200"
      }`}
    >
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] border border-slate-100 bg-slate-50">
        <AnimatedVisual item={item} className="h-full w-full text-[38px]" active={active} plate={false} />

        <button
          ref={registerRef}
          type="button"
          data-card-id={item.id}
          tabIndex={focusable ? 0 : -1}
          onClick={() => {
            onSelect()
            onInspect()
          }}
          onFocus={() => {
            setFocused(true)
            onFocusCard()
          }}
          onBlur={() => setFocused(false)}
          aria-label={`${item.name}, ${item.category}${selected ? ", selected" : ""}`}
          className="absolute inset-0 z-[1] rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#172033]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="truncate text-[17px] font-bold tracking-[-0.02em] text-[#172033]">
            {item.name}
          </h3>

          {selected && (
            <span className="rounded-full bg-[#172033] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white">
              Selected
            </span>
          )}

          {usage > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
              {usage} {usage === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>

        <p className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          {item.category} · {mediaLabel(item)} · {item.motion}
        </p>

        <p className="mt-1 hidden truncate text-[13px] font-medium text-slate-400 md:block">
          {item.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <HeartButton favorite={favorite} name={item.name} onToggle={onToggleFavorite} />

        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview ${item.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#172033] transition hover:border-slate-300 active:scale-95"
        >
          <Play size={14} fill="currentColor" />
        </button>

        <button
          type="button"
          onClick={onSelect}
          className={`hidden h-10 items-center justify-center gap-2 rounded-[11px] px-4 text-[13px] font-bold transition active:scale-[0.98] sm:flex ${
            selected
              ? "bg-[#172033] text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#172033]"
          }`}
        >
          <Check size={15} />
          {selected ? "Selected" : "Select"}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   ANIMATED VISUAL
   Native marks, images and GIFs all run through the same
   physics hook. GIFs keep their own frames and only get the
   pointer tilt / poke.
   ============================================================ */

function AnimatedVisual({
  item,
  className,
  active = true,
  speed = 1,
  interactive = false,
  large = false,
  tone = "light",
  plate = true,
}: {
  item: AnimationItem | null
  className: string
  active?: boolean
  speed?: number
  interactive?: boolean
  large?: boolean
  tone?: Tone
  /** Draw the soft radial backdrop + ground shadow. */
  plate?: boolean
}) {
  const motion: AnimationMotion | null =
    item && item.mediaType !== "gif" ? item.motion : null

  const { ref, bind } = useMotion<HTMLElement>({
    motion,
    active: active && item !== null,
    speed,
    interactive,
    enabled: item !== null,
  })

  if (!item) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className="text-[16px] font-bold text-slate-300">Select an animation</span>
      </div>
    )
  }

  const dark = tone === "dark"
  const origin = originFor(motion)

  return (
    <div
      {...bind}
      className={`relative flex items-center justify-center overflow-hidden ${
        interactive ? "cursor-pointer touch-none" : ""
      } ${className}`}
    >
      {plate && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.98),rgba(241,244,247,0.65)_55%,rgba(230,234,239,0.45)_100%)]" />

          <div className="pointer-events-none absolute bottom-4 left-1/2 h-1.5 w-24 -translate-x-1/2 rounded-full bg-slate-300/40 blur-sm" />
        </>
      )}

      {item.mediaType === "image" || item.mediaType === "gif" ? (
        <img
          ref={ref as React.RefObject<HTMLImageElement>}
          src={item.mediaSrc}
          alt={item.name}
          draggable={false}
          className={`relative z-10 h-full w-full select-none object-contain p-5 ${
            large ? "scale-105" : ""
          }`}
          style={{ transformOrigin: origin, willChange: "transform" }}
        />
      ) : (
        <span
          ref={ref as React.RefObject<HTMLSpanElement>}
          className={`relative z-10 inline-block select-none font-serif font-bold leading-none drop-shadow-[0_10px_18px_rgba(15,23,42,0.14)] ${
            dark ? "text-slate-50" : "text-[#172033]"
          }`}
          style={{ transformOrigin: origin, willChange: "transform" }}
        >
          {item.preview}
        </span>
      )}
    </div>
  )
}

/* ============================================================
   REMINDER SIMULATOR
   ------------------------------------------------------------
   Replays the real reminder entrance on a mock desktop, using
   the same model as the Reminder window:

     - a spring drives progress along a curved Bezier path
       (slight overshoot, then settle)
     - flight velocity feeds a tilt spring and squash/stretch
     - once landed: ripple rings + the animation's own idle
       motion, and clicking it opens the reminder panel
   ============================================================ */

function ReminderSimulator({ item, speed }: { item: AnimationItem; speed: number }) {
  const [runId, setRunId] = useState(0)
  const [settled, setSettled] = useState(false)
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const flightRef = useRef<HTMLButtonElement | null>(null)
  const speedRef = useRef(speed)

  speedRef.current = speed

  useEffect(() => {
    const stage = stageRef.current
    const flight = flightRef.current

    setSettled(false)
    setOpen(false)

    if (!stage || !flight) return

    const reduce = prefersReducedMotion()

    // Normalized stage coordinates (0..1).
    const start = { x: 0.9, y: 0.88 }
    const target = { x: 0.5, y: 0.44 }

    const dx = target.x - start.x
    const dy = target.y - start.y
    const len = Math.hypot(dx, dy) || 1

    const control = {
      x: (start.x + target.x) / 2 + (-dy / len) * len * 0.32,
      y: (start.y + target.y) / 2 + (dx / len) * len * 0.32,
    }

    const progress = new Spring(reduce ? 1 : 0)
    const pop = new Spring(reduce ? 1 : 0.35)
    const tilt = new Spring(0)

    let delay = reduce ? 0 : 0.25
    let acc = 0
    let prev = { ...start }
    let vel = { x: 0, y: 0 }

    const write = (x: number, y: number, stretch: number, theta: number, tiltDeg: number) => {
      const W = stage.clientWidth
      const H = stage.clientHeight

      flight.style.transform =
        `translate(${(x * W).toFixed(1)}px, ${(y * H).toFixed(1)}px) translate(-50%, -50%) ` +
        `rotate(${tiltDeg.toFixed(2)}deg) rotate(${theta.toFixed(3)}rad) ` +
        `scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.75).toFixed(3)}) ` +
        `rotate(${(-theta).toFixed(3)}rad) scale(${pop.x.toFixed(3)})`
    }

    write(start.x, start.y, 0, 0, 0)

    const unsubscribe = subscribe((rawDt) => {
      const dt = rawDt * speedRef.current

      if (delay > 0) delay -= dt

      acc += dt

      const tiltTarget = clamp(vel.x * 14, -16, 16)

      while (acc >= STEP) {
        acc -= STEP

        if (delay <= 0) progress.step(1, 4.6, 0.68, STEP)

        tilt.step(tiltTarget, 11, 0.5, STEP)
        pop.step(1, 10, 0.42, STEP)
      }

      const t = progress.x
      const u = 1 - t

      const x = u * u * start.x + 2 * u * t * control.x + t * t * target.x
      const y = u * u * start.y + 2 * u * t * control.y + t * t * target.y

      const rawVx = (x - prev.x) / Math.max(dt, 1e-4)
      const rawVy = (y - prev.y) / Math.max(dt, 1e-4)
      const k = 1 - Math.exp(-dt * 18)

      vel = { x: vel.x + (rawVx - vel.x) * k, y: vel.y + (rawVy - vel.y) * k }
      prev = { x, y }

      const speedNorm = Math.hypot(vel.x, vel.y)
      const stretch = reduce ? 0 : clamp(speedNorm * 0.14, 0, 0.14)

      write(x, y, stretch, Math.atan2(vel.y, vel.x), tilt.x)

      const arrived =
        delay <= 0 &&
        Math.abs(progress.x - 1) < 0.0008 &&
        Math.abs(progress.v) < 0.004 &&
        Math.abs(pop.x - 1) < 0.002 &&
        Math.abs(tilt.x) < 0.05

      if (arrived) {
        write(target.x, target.y, 0, 0, 0)
        setSettled(true)
        return false
      }
    })

    return unsubscribe
  }, [runId, item.id])

  return (
    <div>
      <div
        ref={stageRef}
        className={`relative aspect-[16/10] w-full overflow-hidden rounded-[22px] border ${
          dark ? "border-slate-700" : "border-slate-200"
        }`}
        style={{
          background: dark
            ? "linear-gradient(135deg,#1e293b 0%,#312e5a 52%,#3b2f4a 100%)"
            : "linear-gradient(135deg,#dbeafe 0%,#e9d5ff 48%,#fde2e4 100%)",
        }}
      >
        {/* Mock windows */}
        <div
          className={`absolute left-[6%] top-[10%] h-[46%] w-[34%] rounded-[12px] border shadow-lg ${
            dark ? "border-white/10 bg-white/10" : "border-white/70 bg-white/60"
          }`}
        >
          <div className={`h-5 rounded-t-[12px] ${dark ? "bg-white/10" : "bg-white/70"}`} />
        </div>

        <div
          className={`absolute right-[7%] top-[16%] h-[38%] w-[30%] rounded-[12px] border shadow-lg ${
            dark ? "border-white/10 bg-white/10" : "border-white/70 bg-white/60"
          }`}
        >
          <div className={`h-5 rounded-t-[12px] ${dark ? "bg-white/10" : "bg-white/70"}`} />
        </div>

        {/* Taskbar */}
        <div
          className={`absolute inset-x-[18%] bottom-[3%] flex h-[9%] items-center justify-center gap-2 rounded-[10px] border backdrop-blur ${
            dark ? "border-white/10 bg-white/10" : "border-white/70 bg-white/50"
          }`}
        >
          {[0, 1, 2, 3, 4].map((dot) => (
            <span
              key={dot}
              className={`h-3.5 w-3.5 rounded-[5px] ${dark ? "bg-white/25" : "bg-slate-400/40"}`}
            />
          ))}
        </div>

        {/* Ripples */}
        {settled && (
          <div className="pointer-events-none absolute left-1/2 top-[44%] h-0 w-0">
            <span className="gl-ripple" style={dark ? { borderColor: "rgba(255,255,255,0.4)" } : undefined} />
            <span className="gl-ripple gl-ripple-2" style={dark ? { borderColor: "rgba(255,255,255,0.4)" } : undefined} />
          </div>
        )}

        {/* The reminder animal */}
        <button
          ref={flightRef}
          type="button"
          disabled={!settled}
          onClick={() => setOpen((v) => !v)}
          aria-label="Open reminder"
          className="absolute left-0 top-0 h-[92px] w-[92px] cursor-pointer border-0 bg-transparent p-0 outline-none disabled:cursor-default"
          style={{ willChange: "transform" }}
        >
          <AnimatedVisual
            item={item}
            className="h-full w-full text-[62px]"
            active={settled}
            tone={dark ? "dark" : "light"}
            plate={false}
          />
        </button>

        {/* Reminder panel */}
        {open && (
          <div
            className="gl-pop absolute left-1/2 top-[44%] z-20 mt-[54px] w-[230px] rounded-[16px] border border-black/10 bg-white p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
            style={{ transformOrigin: "top center" }}
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Reminder
            </p>

            <p className="mt-1 truncate text-[14px] font-bold text-slate-900">Stand up and stretch</p>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {["+5m", "+10m", "+30m"].map((label) => (
                <span
                  key={label}
                  className="flex h-7 items-center justify-center rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <span className="flex h-8 items-center justify-center rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500">
                Stop
              </span>

              <span className="flex h-8 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">
                Finish
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-slate-400">
          {settled ? "Click the animation to open the reminder." : "Flying in..."}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-500 transition hover:border-slate-300 active:scale-95"
          >
            <Monitor size={14} />
            {dark ? "Light desktop" : "Dark desktop"}
          </button>

          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#172033] px-3.5 text-[12px] font-bold text-white transition hover:bg-[#243049] active:scale-95"
          >
            <RotateCcw size={14} />
            Replay
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   PREVIEW MODAL
   ============================================================ */

function PreviewModal({
  item,
  position,
  selected,
  favorite,
  tone,
  onTone,
  speed,
  onSpeed,
  onSelect,
  onToggleFavorite,
  onStep,
  onClose,
}: {
  item: AnimationItem
  position: string | null
  selected: boolean
  favorite: boolean
  tone: Tone
  onTone: (tone: Tone) => void
  speed: number
  onSpeed: (speed: number) => void
  onSelect: () => void
  onToggleFavorite: () => void
  onStep: (delta: number) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<"stage" | "desktop">("stage")

  // Esc closes, arrows page through the current results.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null

      if (target?.closest("input, textarea, select")) return

      if (event.key === "Escape") onClose()
      else if (event.key === "ArrowRight") onStep(1)
      else if (event.key === "ArrowLeft") onStep(-1)
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, onStep])

  // Lock page scroll behind the modal.
  useEffect(() => {
    const previous = document.body.style.overflow

    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      className="gl-fade fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-[4px] md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} preview`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="gl-modal flex max-h-[92vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_35px_100px_rgba(15,23,42,0.24)]">
        {/* HEADER */}

        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-[#f7f8fa] px-6 py-5 md:px-7">
          <div className="min-w-0">
            <p className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Animation Preview{position ? ` · ${position}` : ""}
            </p>

            <h2
              key={item.id}
              className="gl-fade mt-1.5 truncate text-[28px] font-bold tracking-[-0.035em] text-[#172033]"
            >
              {item.name}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="Previous animation"
              className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="Next animation"
              className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
            >
              <ChevronRight size={20} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}

        <div className="min-h-0 overflow-y-auto p-6 md:p-7">
          {/* TABS */}

          <div
            role="tablist"
            aria-label="Preview mode"
            className="mb-5 inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5"
          >
            {(
              [
                ["stage", "Stage"],
                ["desktop", "On desktop"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-200 ${
                  tab === id
                    ? "bg-[#172033] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "stage" ? (
            <div key="stage" className="gl-fade">
              <div
                className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-[24px] border border-slate-200"
                style={stageStyle(tone)}
              >
                <AnimatedVisual
                  item={item}
                  className="h-[360px] w-full text-[130px]"
                  active
                  interactive
                  large
                  speed={speed}
                  tone={tone}
                  plate={false}
                />
              </div>

              <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
                Move over the stage to tilt it. Click to poke it.
              </p>

              <StageControls tone={tone} onTone={onTone} speed={speed} onSpeed={onSpeed} />
            </div>
          ) : (
            <div key="desktop" className="gl-fade">
              <ReminderSimulator item={item} speed={speed} />
            </div>
          )}

          <p className="mt-5 text-[16px] font-medium leading-7 text-slate-500">{item.description}</p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailBlock label="Category" value={item.category} />
            <DetailBlock label="Media" value={mediaLabel(item)} />
            <DetailBlock label="Motion" value={capitalize(item.motion)} />
          </div>

          <p className="mt-4 hidden text-[12px] font-medium text-slate-400 md:block">
            Left and right arrows move through the current results. Esc closes.
          </p>
        </div>

        {/* FOOTER */}

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-[11px] border px-4 text-[13px] font-bold transition active:scale-95 ${
              favorite
                ? "border-red-200 bg-red-50 text-red-500"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-[#172033]"
            }`}
          >
            <Heart size={15} fill={favorite ? "currentColor" : "none"} />
            {favorite ? "Favorited" : "Favorite"}
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-[11px] border border-slate-200 bg-white px-5 text-[13px] font-bold text-slate-500 transition hover:border-slate-300 hover:text-[#172033] active:scale-95"
            >
              Close
            </button>

            <button
              type="button"
              onClick={onSelect}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[#172033] px-5 text-[13px] font-bold text-white transition hover:bg-[#243049] active:scale-95"
            >
              <Check size={16} />
              {selected ? "Selected for New Tasks" : "Use for New Tasks"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   SMALL PIECES
   ============================================================ */

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p
        className="mt-1.5 text-[19px] font-bold text-[#172033]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {children}
      </p>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  onClick,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick?: () => void
  hint?: string
}) {
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
        {icon}
      </span>

      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>

      <span className="ml-auto max-w-[48%] truncate text-right text-[13px] font-bold text-slate-600">
        {value}
      </span>
    </>
  )

  const base = "flex w-full items-center gap-3 rounded-[13px] border border-slate-100 bg-slate-50 px-4 py-3"

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`${base} text-left transition hover:border-slate-200 hover:bg-white active:scale-[0.99]`}
    >
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 truncate text-[16px] font-bold text-[#172033]">{value}</p>
    </div>
  )
}

function EmptyGallery({
  onReset,
  favoritesOnly,
}: {
  onReset: () => void
  favoritesOnly: boolean
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-white/60 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 text-slate-400">
        {favoritesOnly ? <Heart size={26} /> : <Search size={26} />}
      </div>

      <p className="mt-5 text-[21px] font-bold text-slate-700">
        {favoritesOnly ? "No favorites yet" : "No animations found"}
      </p>

      <p className="mt-2 max-w-md text-[14px] font-medium leading-6 text-slate-400">
        {favoritesOnly
          ? "Tap the heart on any animation to keep it here for quick access."
          : "The library is fine, but your current search or filters do not match anything."}
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-[11px] bg-[#172033] px-5 text-[13px] font-bold text-white transition hover:bg-[#243049] active:scale-95"
      >
        <RotateCcw size={15} />
        Clear filters
      </button>
    </div>
  )
}