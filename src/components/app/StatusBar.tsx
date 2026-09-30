export function StatusBar() {
  return (
    <footer
      className="
        relative
        flex
        h-[48px]
        shrink-0
        items-center
        justify-between
        overflow-hidden
        border-t
        border-slate-200/80
        bg-white/70
        px-5
        md:px-6
      "
    >
      {/* =====================================================
          SUBTLE SILVER SHEEN
          ===================================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-y-0
          left-[-20%]
          w-[30%]
          skew-x-[-20deg]
          bg-gradient-to-r
          from-transparent
          via-slate-200/30
          to-transparent
          animate-[lp-status-sheen_7s_ease-in-out_infinite]
        "
      />

      {/* =====================================================
          LEFT — L&P STATUS
          ===================================================== */}

      <div className="relative flex items-center gap-3">
        <span className="font-serif text-[15px] font-bold italic tracking-[-0.04em] text-[#172033]">
          L&P
        </span>

        <span className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="
                absolute
                inset-0
                animate-ping
                rounded-full
                bg-emerald-400
                opacity-30
              "
            />

            <span
              className="
                relative
                h-2.5
                w-2.5
                rounded-full
                bg-emerald-500
              "
            />
          </span>

          <span
            className="
              font-mono
              text-[11px]
              font-bold
              uppercase
              tracking-[0.14em]
              text-slate-500
            "
          >
            Running
          </span>
        </div>
      </div>

      {/* =====================================================
          RIGHT — REMINDER ENGINE
          ===================================================== */}

      <div className="relative flex items-center gap-3">

        <span
          className="
            hidden
            font-mono
            text-[10px]
            font-semibold
            uppercase
            tracking-[0.12em]
            text-slate-400
            sm:block
          "
        >
          Reminder Engine
        </span>

        <span
          className="
            rounded-full
            border
            border-slate-200
            bg-slate-50
            px-3
            py-1
            font-mono
            text-[10px]
            font-bold
            uppercase
            tracking-[0.12em]
            text-slate-500
          "
        >
          Standby
        </span>
      </div>

      <style>
        {`
          @keyframes lp-status-sheen {
            0% {
              transform: translateX(-80%);
              opacity: 0;
            }

            25% {
              opacity: 1;
            }

            50% {
              transform: translateX(420%);
              opacity: 0;
            }

            100% {
              transform: translateX(420%);
              opacity: 0;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            @keyframes lp-status-sheen {
              from,
              to {
                transform: translateX(0);
                opacity: 0;
              }
            }
          }
        `}
      </style>
    </footer>
  )
}