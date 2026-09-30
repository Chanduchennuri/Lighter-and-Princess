import {
  Home,
  ListTodo,
  CalendarDays,
  Images,
  Settings,
  AudioWaveform,
  User
} from "lucide-react"

type Page =
  | "today"
  | "tasks"
  | "calendar"
  | "gallery"
  | "settings"

interface SystemNavigationProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const navigation = [
  {
    id: "today" as const,
    icon: Home,
    label: "Today",
  },
  {
    id: "tasks" as const,
    icon: ListTodo,
    label: "Tasks",
  },
  {
    id: "calendar" as const,
    icon: CalendarDays,
    label: "Calendar",
  },
  {
    id: "gallery" as const,
    icon: Images,
    label: "Gallery",
  },
  {
    id: "settings" as const,
    icon: Settings,
    label: "Settings",
  },
]

export function SystemNavigation({
  activePage,
  onNavigate,
}: SystemNavigationProps) {
  return (
    <section
      className="
        relative
        shrink-0
        overflow-hidden
        rounded-[22px]
        border
        border-slate-200/80
        bg-white/90
        p-4
        shadow-[0_12px_35px_rgba(30,45,65,0.07)]
        backdrop-blur-xl
      "
    >
      {/* Subtle top accent */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-6
          right-6
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-slate-300
          to-transparent
        "
      />

      {/* Section title */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p
            className="
              font-mono
              text-[10px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-slate-500
            "
          >
            <User />
          </p>

          <p
            className="
              mt-1
              text-[13px]
              font-medium
              italic
              tracking-tight
              text-slate-400
            "
          >
             workspace
          </p>
        </div>

        <span
          className="
            font-serif
            text-[16px]
            font-bold
            italic
            tracking-[-0.04em]
            text-[#172033]/70
          "
        >
          <AudioWaveform />
        </span>
      </div>

      {/* Navigation */}
      <div
        className="
          grid
          shrink-0
          grid-cols-5
          gap-1.5
          rounded-[16px]
          border
          border-slate-200/70
          bg-slate-100/80
          p-1.5
        "
      >
        {navigation.map((item) => {
          const Icon = item.icon
          const active =
            activePage === item.id

          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={
                active
                  ? "page"
                  : undefined
              }
              onClick={() =>
                onNavigate(item.id)
              }
              className={`
                group
                relative
                flex
                h-[54px]
                min-w-0
                shrink-0
                flex-col
                items-center
                justify-center
                gap-1
                rounded-[12px]
                transition-all
                duration-250
                ease-out
                ${
                  active
                    ? `
                      bg-[#152033]
                      text-white
                      shadow-[0_8px_20px_rgba(21,32,51,0.20)]
                      -translate-y-px
                    `
                    : `
                      text-slate-400
                      hover:bg-white
                      hover:text-[#172033]
                      hover:shadow-sm
                    `
                }
              `}
            >
              {/* active indicator */}
              <span
                className={`
                  absolute
                  left-1/2
                  top-1.5
                  h-0.5
                  w-4
                  -translate-x-1/2
                  rounded-full
                  transition-all
                  duration-250
                  ${
                    active
                      ? "bg-white/80 opacity-100"
                      : "bg-transparent opacity-0"
                  }
                `}
              />

              <Icon
                size={19}
                strokeWidth={
                  active
                    ? 2
                    : 1.8
                }
                className="
                  shrink-0
                  transition-transform
                  duration-200
                  group-hover:-translate-y-0.5
                "
              />

              <span
                className={`
                  hidden
                  whitespace-nowrap
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  sm:block
                  ${
                    active
                      ? "text-white/90"
                      : "text-slate-400"
                  }
                `}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
