import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  Home,
  Settings,
  Sparkles,
} from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/characters", label: "Characters", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  return (
    <nav
      aria-label="Main navigation"
      className="flex aspect-square w-full max-w-[220px] flex-col items-center justify-center rounded-full border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl"
    >
      <div className="mb-4 grid size-10 place-items-center rounded-full bg-white text-sm font-bold text-slate-950">
        LP
      </div>

      <div className="grid grid-cols-2 gap-2">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            className={({ isActive }) =>
              `group relative grid size-10 place-items-center rounded-full transition ${
                isActive
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                  : "text-slate-500 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon size={17} strokeWidth={1.8} />

            <span className="pointer-events-none absolute right-12 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-xs text-white opacity-0 shadow-xl transition group-hover:opacity-100">
              {label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}