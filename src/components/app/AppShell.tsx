import type { ReactNode } from "react"

import { AppHeader } from "./AppHeader"
import { SystemNavigation } from "./SystemNavigation"
import { UserIdentity } from "./UserIdentity"
import { RuntimeHealth } from "./RuntimeHealth"
import { ThemePreset } from "./ThemePreset"
import { BackgroundGrid } from "./BackgroundGrid"
import { PhysicsBackground } from "./PhysicsBackground"
import { StatusBar } from "./StatusBar"

export type Page =
  | "today"
  | "tasks"
  | "calendar"
  | "gallery"
  | "settings"

interface AppShellProps {
  children: ReactNode
  activePage: Page
  onNavigate: (page: Page) => void
}

export function AppShell({
  children,
  activePage,
  onNavigate,
}: AppShellProps) {
  return (
    <>
      {/* =====================================================
          L&P SHELL MOTION
          ===================================================== */}

      <style>
        {`
          @keyframes lp-main-enter {
            from {
              opacity: 0;
              transform: translateY(8px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes lp-sidebar-enter {
            from {
              opacity: 0;
              transform: translateX(10px);
            }

            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .lp-main-enter,
            .lp-sidebar-enter {
              animation: none !important;
            }
          }
        `}
      </style>

      {/* =====================================================
          ROOT
          ===================================================== */}

      <div
        className="
          relative
          h-[100dvh]
          w-full
          overflow-hidden
          bg-[#edf1f5]
          text-[#172033]
        "
      >
        {/* ===================================================
            MATHEMATICAL BACKGROUND
            =================================================== */}

        <BackgroundGrid />

        <PhysicsBackground />

        {/* ===================================================
            APPLICATION LAYER
            =================================================== */}

        <div
          className="
            relative
            z-10
            h-full
            min-h-0
            p-3
            md:p-4
          "
        >
          <div
            className="
              mx-auto
              grid
              h-full
              min-h-0
              max-h-full
              max-w-[1500px]
              grid-cols-1
              grid-rows-[minmax(0,1fr)]
              gap-3
              lg:grid-cols-[minmax(0,1fr)_350px]
              lg:gap-4
            "
          >
            {/* =================================================
                MAIN APPLICATION
                ================================================= */}

            <main
              className="
                relative
                grid
                h-full
                min-h-0
                min-w-0
                grid-rows-[72px_minmax(0,1fr)_auto]
                overflow-hidden
                rounded-[22px]
                border
                border-slate-200/80
                bg-white/95
                shadow-[0_18px_50px_rgba(30,45,65,0.09)]
                backdrop-blur-xl
                lp-main-enter
              "
              style={{
                animation:
                  "lp-main-enter 480ms cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            >
              {/* =================================================
                  L&P HEADER
                  ================================================= */}

              <div className="min-h-0">
                <AppHeader />
              </div>

              {/* =================================================
                  PAGE SCROLL AREA
                  ================================================= */}

              <div
                className="
                  relative
                  min-h-0
                  min-w-0
                  overflow-x-hidden
                  overflow-y-auto
                  overscroll-y-contain
                  scroll-smooth
                  touch-pan-y
                "
                style={{
                  WebkitOverflowScrolling:
                    "touch",
                  scrollBehavior:
                    "smooth",
                }}
              >
                <div
                  className="
                    min-h-full
                    min-w-0
                  "
                >
                  {children}
                </div>
              </div>

              {/* =================================================
                  STATUS BAR
                  ================================================= */}

              <div className="min-h-0 shrink-0">
                <StatusBar />
              </div>
            </main>

            {/* =================================================
                SIDEBAR
                ================================================= */}

            <aside
              className="
                flex
                min-h-0
                min-w-0
                flex-col
                gap-3
                overflow-y-auto
                lg:gap-4
                lp-sidebar-enter
              "
              style={{
                animation:
                  "lp-sidebar-enter 480ms cubic-bezier(0.16, 1, 0.3, 1) 100ms both",
              }}
            >
              <SystemNavigation
                activePage={activePage}
                onNavigate={onNavigate}
              />

              <UserIdentity />

              <RuntimeHealth />

              <ThemePreset />
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}