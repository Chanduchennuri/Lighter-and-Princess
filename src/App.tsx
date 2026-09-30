import { useState } from "react"

import { AppShell } from "./components/app/AppShell"

import { Today } from "./pages/Today"
import { Tasks } from "./pages/Tasks"
import { Gallery } from "./pages/Gallery"
import { Calendar } from "./pages/Calendar"
import { Settings } from "./pages/Settings"
import { Reminder } from "./pages/Reminder"

export type AppPage =
  | "today"
  | "tasks"
  | "calendar"
  | "gallery"
  | "settings"

function App() {
  const [activePage, setActivePage] =
    useState<AppPage>("today")

  const pathname = window.location.pathname

  if (pathname.startsWith("/reminder/")) {
    return <Reminder />
  }

  function renderPage() {
    switch (activePage) {
      case "today":
        return (
          <Today
            onNavigate={setActivePage}
          />
        )

      case "tasks":
        return <Tasks />

      case "calendar":
        return <Calendar />

      case "gallery":
        return <Gallery />

      case "settings":
        return <Settings />

      default:
        return (
          <Today
            onNavigate={setActivePage}
          />
        )
    }
  }

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
    >
      {renderPage()}
    </AppShell>
  )
}

export default App