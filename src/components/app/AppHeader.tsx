export function AppHeader() {
  return (
    <header
      className="
        flex
        h-[72px]
        shrink-0
        items-center
        justify-between
        border-b
        border-slate-200/80
        px-5
        md:px-7
      "
    >
      {/* =====================================================
          LEFT — L&P BRAND
          ===================================================== */}

      <div className="flex min-w-0 items-center gap-4">

        {/* Window controls */}

        <div className="flex shrink-0 items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff605c]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd44]" />
          <span className="h-3 w-3 rounded-full bg-[#00ca4e]" />
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* Brand */}

        <div className="min-w-0">

          <div className="flex items-baseline gap-2.5">

            <span
              className="
                font-serif
                text-[23px]
                font-bold
                italic
                leading-none
                tracking-[-0.055em]
                text-[#172033]
              "
            >
              LunarFlow``
            </span>

            

          </div>

          <p
            className="
              mt-1.5
              font-mono
              text-[9px]
              font-semibold
              uppercase
              tracking-[0.17em]
              text-slate-400
            "
          >
            Plan your Task's Smartly..
          </p>

        </div>

      </div>

      {/* =====================================================
          RIGHT — REMINDER STATUS
          ===================================================== */}

      <div
        className="
          flex
          shrink-0
          items-center
          gap-2.5
          rounded-full
          border
          border-slate-200
          bg-slate-50
          px-3.5
          py-2
        "
      >
        <span className="relative flex h-2 w-2">
          <span
            className="
              absolute
              h-full
              w-full
              animate-ping
              rounded-full
              bg-emerald-400
              opacity-40
            "
          />

          <span
            className="
              relative
              h-2
              w-2
              rounded-full
              bg-emerald-500
            "
          />
        </span>

        <span
          className="
            font-mono
            text-[10px]
            font-bold
            uppercase
            tracking-[0.12em]
            text-slate-500
          "
        >
          Reminders Ready
        </span>
      </div>

    </header>
  )
}