const actionButtons = [
  { id: "new-save", label: "新建存档" },
  { id: "existing-save", label: "已有存档" },
];

const resourceButtons = [
  { id: "wiki", label: "Wiki" },
  { id: "github", label: "GitHub" },
];

const communityButtons = [
  { id: "reddit", label: "Reddit" },
  { id: "discord", label: "Discord" },
];

const supportButtons = [
  { id: "patreon", label: "Patreon" },
  { id: "donate", label: "Donate" },
];

const buttonClass =
  "rounded-md border border-neutral-800 bg-neutral-950/40 px-3 py-1.5 text-xs text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900";

export default function TopNavButtons() {
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label="顶部操作">
      <div className="flex items-center gap-2">
        {actionButtons.map((item) => (
          <button key={item.id} type="button" className={buttonClass}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="hidden h-6 w-px bg-neutral-800 sm:block" />

      <div className="flex items-center gap-2">
        {resourceButtons.map((item) => (
          <button key={item.id} type="button" className={buttonClass}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="hidden h-6 w-px bg-neutral-800 sm:block" />

      <div className="flex items-center gap-2">
        {communityButtons.map((item) => (
          <button key={item.id} type="button" className={buttonClass}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="hidden h-6 w-px bg-neutral-800 sm:block" />

      <div className="flex items-center gap-2">
        {supportButtons.map((item) => (
          <button key={item.id} type="button" className={buttonClass}>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
