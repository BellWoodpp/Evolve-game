export default function Home() {
  return (
    <div
      className="h-[calc(100vh-var(--topbar-height,0px))] w-full"
      id="game"
    >
      <iframe
        src="/evolve-master/index.html"
        title="Evolve Game"
        className="h-full w-full border-0"
      />
    </div>
  );
}
