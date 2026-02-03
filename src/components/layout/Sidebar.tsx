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
  "w-full rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900";

export default function Sidebar() {
  return (
    <aside className="hidden lg:block w-64 shrink-0 border-r border-neutral-800 bg-neutral-950/70 backdrop-blur-md text-neutral-100">
      <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-4 py-6">
        <nav className="space-y-4">
          <div className="space-y-2">
            {actionButtons.map((item) => (
              <button key={item.id} type="button" className={buttonClass}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {resourceButtons.map((item) => (
              <button key={item.id} type="button" className={buttonClass}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="border-t border-neutral-800 pt-4 space-y-2">
            {communityButtons.map((item) => (
              <button key={item.id} type="button" className={buttonClass}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {supportButtons.map((item) => (
              <button key={item.id} type="button" className={buttonClass}>
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}
