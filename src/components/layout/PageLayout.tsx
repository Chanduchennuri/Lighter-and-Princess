import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

type PageLayoutProps = {
  children: ReactNode;
};

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#080d19] text-slate-100">
      <div className="pointer-events-none fixed -left-40 -top-40 size-[ thirtyrem] rounded-full bg-violet-600/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 size-[ thirtyrem] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.5),transparent_60%)]" />

      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-6 pb-16 pr-32 pt-12">
        {children}
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}