export type AnimationMediaType =
  | "native"
  | "image"
  | "gif"

export type AnimationMotion =
  | "float"
  | "bounce"
  | "orbit"
  | "pulse"
  | "shake"
  | "drift"
  | "swing"
  | "spin"

export interface AnimationItem {
  id: string
  name: string
  description: string
  category: string
  preview: string
  mediaType: AnimationMediaType
  mediaSrc?: string
  motion: AnimationMotion
  tags: string[]
  isBuiltIn: boolean
}

/*
 * Core L&P animations.
 *
 * This file is now self-contained: animations.ts is no longer required.
 * Existing task IDs continue to resolve through animationLibrary.
 */
const PIG_RUNNER_GIF_SRC = "/animations/custom/pig_running.gif"

const builtInAnimations: AnimationItem[] = [
  {
    id: "pig_runner",
    name: "Pig Runner",
    description:
      "A cheerful pig running across the screen when the reminder appears.",
    category: "Animals",
    preview: "🐷",
    mediaType: "gif",
    mediaSrc: PIG_RUNNER_GIF_SRC,
    motion: "bounce",
    tags: ["pig", "animal", "runner", "running", "built-in"],
    isBuiltIn: true,
  },
  {
  id: "dog_runner",
  name: "Dog Runner",
  description:
    "A cheerful dog running across the screen when the reminder appears.",
  category: "Animals",
  preview: "🐷",
  mediaType: "gif",
  mediaSrc: "/animations/custom/dog_running.gif",
  motion: "bounce",
  tags: ["pig", "animal", "runner", "running", "built-in"],
  isBuiltIn: true,
},
  {
    id: "cat_walker",
    name: "Cat Walker",
    description:
      "A friendly walking cat for light and playful reminders.",
    category: "Animals",
    preview: "🐈",
    mediaType: "native",
    motion: "swing",
    tags: ["cat", "animal", "walker", "walking", "built-in"],
    isBuiltIn: true,
  },
  {
    id: "desk_robot",
    name: "Desk Robot",
    description:
      "A compact desk robot for focused work reminders.",
    category: "Characters",
    preview: "🤖",
    mediaType: "native",
    motion: "bounce",
    tags: ["robot", "desk", "character", "built-in"],
    isBuiltIn: true,
  },
  {
    id: "focus_orbit",
    name: "Focus Orbit",
    description:
      "A calm orbiting focus marker for concentration sessions.",
    category: "Focus",
    preview: "🎯",
    mediaType: "native",
    motion: "orbit",
    tags: ["focus", "orbit", "concentration", "built-in"],
    isBuiltIn: true,
  },
  {
    id: "signal_wave",
    name: "Signal Wave",
    description:
      "A technical signal pulse for notification-style reminders.",
    category: "Fun",
    preview: "📡",
    mediaType: "native",
    motion: "pulse",
    tags: ["signal", "wave", "tech", "notification", "built-in"],
    isBuiltIn: true,
  },
  {
    id: "fox_runner",
    name: "Fox Runner",
    description:
      "A playful fox runner for energetic reminders.",
    category: "Animals",
    preview: "🦊",
    mediaType: "native",
    motion: "bounce",
    tags: ["fox", "animal", "runner", "running", "built-in"],
    isBuiltIn: true,
  },
]

/*
 * Additional L&P library entries.
 * These deliberately use original/generic visual marks rather than
 * embedding third-party copyrighted artwork or trademark files.
 */
const expandedAnimations: AnimationItem[] = [
  {
    id: "anime_neon_hero",
    name: "Neon Hero",
    description:
      "Anime-inspired sci-fi hero with a gentle hover motion.",
    category: "Anime",
    preview: "🧑‍🚀",
    mediaType: "native",
    motion: "float",
    tags: ["anime", "hero", "scifi", "character"],
    isBuiltIn: true,
  },
  {
    id: "anime_shadow_ninja",
    name: "Shadow Ninja",
    description:
      "Fast ninja-style character with a subtle combat shake.",
    category: "Anime",
    preview: "🥷",
    mediaType: "native",
    motion: "shake",
    tags: ["anime", "ninja", "character", "action"],
    isBuiltIn: true,
  },
  {
    id: "anime_mecha",
    name: "Pocket Mecha",
    description:
      "Small robotic character with a controlled mechanical bob.",
    category: "Anime",
    preview: "🦾",
    mediaType: "native",
    motion: "bounce",
    tags: ["anime", "mecha", "robot", "character"],
    isBuiltIn: true,
  },
  {
    id: "space_rocket",
    name: "Rocket Launch",
    description:
      "A launch-ready rocket with vertical lift motion.",
    category: "Space",
    preview: "🚀",
    mediaType: "native",
    motion: "bounce",
    tags: ["space", "rocket", "launch"],
    isBuiltIn: true,
  },
  {
    id: "space_satellite",
    name: "Orbit Satellite",
    description:
      "Satellite drifting through a small orbital loop.",
    category: "Space",
    preview: "🛰️",
    mediaType: "native",
    motion: "orbit",
    tags: ["space", "satellite", "orbit"],
    isBuiltIn: true,
  },
  {
    id: "space_planet",
    name: "Blue Planet",
    description:
      "A planet with a slow rotating presentation.",
    category: "Space",
    preview: "🌍",
    mediaType: "native",
    motion: "spin",
    tags: ["space", "planet", "earth"],
    isBuiltIn: true,
  },
  {
    id: "space_moon",
    name: "Moon Drift",
    description:
      "Quiet lunar drift for low-distraction reminders.",
    category: "Space",
    preview: "🌙",
    mediaType: "native",
    motion: "drift",
    tags: ["space", "moon", "night"],
    isBuiltIn: true,
  },
  {
    id: "car_sport",
    name: "Sport Car",
    description:
      "A compact sports car with a smooth road-bounce effect.",
    category: "Cars",
    preview: "🏎️",
    mediaType: "native",
    motion: "bounce",
    tags: ["car", "cars", "sport", "racing"],
    isBuiltIn: true,
  },
  {
    id: "car_classic",
    name: "Classic Ride",
    description:
      "Classic automobile presentation with gentle suspension sway.",
    category: "Cars",
    preview: "🚗",
    mediaType: "native",
    motion: "swing",
    tags: ["car", "cars", "classic", "vehicle"],
    isBuiltIn: true,
  },
  {
    id: "nature_tree",
    name: "Forest Tree",
    description:
      "A calm tree animation with a soft side-to-side breeze.",
    category: "Nature",
    preview: "🌳",
    mediaType: "native",
    motion: "swing",
    tags: ["nature", "tree", "forest", "calm"],
    isBuiltIn: true,
  },
  {
    id: "nature_mountain",
    name: "Mountain Glow",
    description:
      "Mountain scene with slow ambient light pulsing.",
    category: "Nature",
    preview: "🏔️",
    mediaType: "native",
    motion: "pulse",
    tags: ["nature", "mountain", "landscape"],
    isBuiltIn: true,
  },
  {
    id: "nature_flower",
    name: "Wild Flower",
    description:
      "A flower that gently sways like it is in a breeze.",
    category: "Nature",
    preview: "🌻",
    mediaType: "native",
    motion: "swing",
    tags: ["nature", "flower", "garden"],
    isBuiltIn: true,
  },
  {
    id: "animal_fox",
    name: "Fox Friend",
    description:
      "Friendly fox with a light idle bounce.",
    category: "Animals",
    preview: "🦊",
    mediaType: "native",
    motion: "bounce",
    tags: ["animal", "fox", "friend"],
    isBuiltIn: true,
  },
  {
    id: "animal_panda",
    name: "Panda Pal",
    description:
      "Panda companion with a soft breathing pulse.",
    category: "Animals",
    preview: "🐼",
    mediaType: "native",
    motion: "pulse",
    tags: ["animal", "panda", "cute"],
    isBuiltIn: true,
  },
  {
    id: "animal_cat",
    name: "Sleepy Cat",
    description:
      "Low-motion cat for quiet reminders.",
    category: "Animals",
    preview: "🐈",
    mediaType: "native",
    motion: "drift",
    tags: ["animal", "cat", "quiet", "cute"],
    isBuiltIn: true,
  },
  {
    id: "animal_dog",
    name: "Happy Dog",
    description:
      "Playful dog with a cheerful bounce.",
    category: "Animals",
    preview: "🐕",
    mediaType: "native",
    motion: "bounce",
    tags: ["animal", "dog", "pet", "cute"],
    isBuiltIn: true,
  },
  {
    id: "bird_eagle",
    name: "Eagle Flight",
    description:
      "Eagle-inspired flight loop with a wide drift.",
    category: "Birds",
    preview: "🦅",
    mediaType: "native",
    motion: "drift",
    tags: ["bird", "eagle", "flight"],
    isBuiltIn: true,
  },
  {
    id: "bird_penguin",
    name: "Penguin Walk",
    description:
      "A compact penguin walk with playful rocking.",
    category: "Birds",
    preview: "🐧",
    mediaType: "native",
    motion: "swing",
    tags: ["bird", "penguin", "walk", "cute"],
    isBuiltIn: true,
  },
  {
    id: "logo_lp",
    name: "L&P Monogram",
    description:
      "Native L&P signature mark for a minimal reminder style.",
    category: "Logos",
    preview: "L&P",
    mediaType: "native",
    motion: "pulse",
    tags: ["logo", "lp", "brand", "minimal"],
    isBuiltIn: true,
  },
  {
    id: "logo_ai",
    name: "AI Core",
    description:
      "Minimal AI-inspired badge with a technical pulse.",
    category: "Logos",
    preview: "AI",
    mediaType: "native",
    motion: "pulse",
    tags: ["logo", "ai", "artificial-intelligence", "tech"],
    isBuiltIn: true,
  },
  {
    id: "logo_code",
    name: "Code Mark",
    description:
      "Developer-style code mark for engineering reminders.",
    category: "Logos",
    preview: "</>",
    mediaType: "native",
    motion: "shake",
    tags: ["logo", "code", "developer", "programming"],
    isBuiltIn: true,
  },
  {
    id: "logo_cloud",
    name: "Cloud Node",
    description:
      "Cloud infrastructure-inspired reminder badge.",
    category: "Logos",
    preview: "☁️",
    mediaType: "native",
    motion: "float",
    tags: ["logo", "cloud", "aws", "azure", "infrastructure"],
    isBuiltIn: true,
  },
  {
    id: "fun_lightning",
    name: "Lightning",
    description:
      "Fast energy pulse for high-attention reminders.",
    category: "Fun",
    preview: "⚡",
    mediaType: "native",
    motion: "shake",
    tags: ["fun", "energy", "power"],
    isBuiltIn: true,
  },
  {
    id: "fun_gamepad",
    name: "Arcade",
    description:
      "Gamepad badge with a quick controller-style bounce.",
    category: "Fun",
    preview: "🎮",
    mediaType: "native",
    motion: "bounce",
    tags: ["fun", "gaming", "gamepad"],
    isBuiltIn: true,
  },
  {
    id: "lifestyle_coffee",
    name: "Coffee Break",
    description:
      "Warm coffee cup with a slow steam-like float.",
    category: "Lifestyle",
    preview: "☕",
    mediaType: "native",
    motion: "float",
    tags: ["lifestyle", "coffee", "break"],
    isBuiltIn: true,
  },
  {
    id: "lifestyle_music",
    name: "Music Note",
    description:
      "Music note that gently bobs for creative sessions.",
    category: "Lifestyle",
    preview: "🎵",
    mediaType: "native",
    motion: "float",
    tags: ["lifestyle", "music", "creative"],
    isBuiltIn: true,
  },
]

/*
 * Single shared catalog used by Gallery, CreateTaskDialog, Calendar and Reminder.
 * Core task IDs and expanded library IDs all resolve from this one registry.
 */
export const animationLibrary: AnimationItem[] = [
  ...builtInAnimations,
  ...expandedAnimations,
]

export function getAnimationById(
  id: string | null | undefined,
): AnimationItem | null {
  if (!id) {
    return null
  }

  return (
    animationLibrary.find(
      (animation) => animation.id === id,
    ) ?? null
  )
}

export function getAnimationCategories(): string[] {
  return [
    "All",
    ...Array.from(
      new Set(
        animationLibrary.map(
          (animation) => animation.category,
        ),
      ),
    ).sort((a, b) => a.localeCompare(b)),
  ]
}

export function filterAnimations(
  search: string,
  category: string,
): AnimationItem[] {
  const query = search.trim().toLowerCase()

  return animationLibrary.filter(
    (animation) => {
      const haystack = [
        animation.name,
        animation.description,
        animation.category,
        ...animation.tags,
      ]
        .join(" ")
        .toLowerCase()

      const matchesSearch =
        !query || haystack.includes(query)

      const matchesCategory =
        category === "All" ||
        animation.category === category

      return (
        matchesSearch &&
        matchesCategory
      )
    },
  )
}

export function getDefaultMotion(
  category: string,
): AnimationMotion {
  switch (category.toLowerCase()) {
    case "animals":
    case "birds":
      return "bounce"

    case "characters":
    case "anime":
      return "float"

    case "space":
      return "orbit"

    case "cars":
      return "bounce"

    case "nature":
      return "swing"

    case "logos":
      return "pulse"

    default:
      return "float"
  }
}

/*
 * Convert a user-provided GIF/image into the same catalog shape.
 * Put the asset in the app's public media folder and pass its public URL
 * as mediaSrc. Animated GIFs are rendered as normal <img> media by the
 * Calendar/Reminder consumers.
 * Example:
 *   /animations/custom/my-reminder.gif
 */
export function createMediaAnimation(options: {
  id: string
  name: string
  description: string
  category: string
  mediaType: "image" | "gif"
  mediaSrc: string
  tags?: string[]
  motion?: AnimationMotion
}): AnimationItem {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    category: options.category,
    preview: options.mediaType === "gif" ? "GIF" : "IMG",
    mediaType: options.mediaType,
    mediaSrc: options.mediaSrc,
    motion: options.motion ?? "float",
    tags: options.tags ?? [],
    isBuiltIn: false,
  }
}
