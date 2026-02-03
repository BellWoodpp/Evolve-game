import Image from "next/image";
import TopNavButtons from "@/components/layout/TopNavButtons";

export default function Header() {
  return (
    <header
      id="topbar"
      className="fixed left-0 right-0 top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 text-neutral-100 backdrop-blur-md"
    >
      <div className="relative mx-auto flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight shrink-0">
            <Image
              src="/earth.webp"
              alt="Evolve Game icon"
              width={28}
              height={28}
              className="h-7 w-7 rounded-full"
              priority
            />
            <span>Evolve Game</span>
          </span>
          <TopNavButtons />
        </div>
        <div className="ml-auto flex items-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 shadow-sm transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            登录
          </a>
        </div>
      </div>
    </header>
  );
}
