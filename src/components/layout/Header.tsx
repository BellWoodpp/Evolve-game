import Image from "next/image";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-950/80 text-neutral-100 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center">
          <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
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
        </div>
        <div className="flex flex-1 items-center justify-end">
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
