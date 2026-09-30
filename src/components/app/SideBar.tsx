import {
  CalendarDays,
  CheckCheck,
  Circle,
  ClipboardList,
  GalleryHorizontal,
  Home,
  Settings,
} from "lucide-react"

import type { AppPage } from "../../App"

interface SidebarProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
}

const navigation: {
  id: AppPage
  label: string
  icon: typeof Home
}[] = [
  {
    id: "today",
    label: "Today",
    icon: Home,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: ClipboardList,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
  },
  {
    id: "gallery",
    label: "Gallery",
    icon: GalleryHorizontal,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
]

export function Sidebar({
  activePage,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="flex min-h-[600px] flex-col gap-4">

      {/* Navigation */}
      <section className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_35px_rgba(30,45,65,0.07)] backdrop-blur-xl">

        <div className="mb-4 flex items-center justify-between px-1">

          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            System
          </p>

          <span className="font-mono text-[8px] uppercase tracking-widest text-slate-300">
            v0.1
          </span>

        </div>

        <nav className="space-y-1">

          {navigation.map((item) => {
            const Icon = item.icon
            const active = activePage === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`
                  group
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-3
                  py-2.5
                  text-left
                  transition-all
                  duration-200
                  ${
                    active
                      ? "bg-[#172033] text-white shadow-[0_8px_20px_rgba(23,32,51,0.16)]"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }
                `}
              >

                <Icon
                  size={16}
                  strokeWidth={active ? 2 : 1.7}
                />

                <span className="flex-1 text-xs font-medium">
                  {item.label}
                </span>

                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}

              </button>
            )
          })}

        </nav>

      </section>

      {/* Today's summary */}
      <section className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_35px_rgba(30,45,65,0.07)] backdrop-blur-xl">

        <div className="mb-5 flex items-center justify-between">

          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Today
          </p>

          <Circle
            size={12}
            className="fill-emerald-500 text-emerald-500"
          />

        </div>

        <div className="flex items-end justify-between">

          <div>
            <p className="text-3xl font-medium tracking-tight text-[#172033]">
              01
            </p>

            <p className="mt-1 text-[10px] text-slate-400">
              active reminder
            </p>
          </div>

          <div className="text-right">

            <p className="font-mono text-sm font-medium text-slate-700">
              14:30
            </p>

            <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">
              next
            </p>

          </div>

        </div>

      </section>

      {/* Selected animation */}
      <section className="flex flex-1 flex-col justify-between rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_35px_rgba(30,45,65,0.07)] backdrop-blur-xl">

        <div>

          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Reminder Character
          </p>

          <div className="mt-5 flex flex-col items-center">

            <div
              className="
                flex
                h-28
                w-28
                items-center
                justify-center
                rounded-3xl
                border
                border-slate-200
                bg-slate-50
                text-5xl
                shadow-inner
              "
            >
              🐷
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Pig Runner
            </p>

            <p className="mt-1 text-[10px] text-slate-400">
              Selected animation
            </p>

          </div>

        </div>

        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">

          <div className="flex items-center gap-2">

            <CheckCheck
              size={13}
              className="text-emerald-500"
            />

            <span className="text-[10px] text-slate-500">
              Ready to remind
            </span>

          </div>

          <button
            type="button"
            onClick={() => onNavigate("gallery")}
            className="font-mono text-[9px] uppercase tracking-wider text-slate-400 transition hover:text-slate-700"
          >
            Change
          </button>

        </div>

      </section>

    </aside>
  )
}