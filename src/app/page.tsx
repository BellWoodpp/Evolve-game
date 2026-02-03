export default function Home() {
  return (
    <div className="h-full min-h-0" id="game">
      <iframe
        src="/evolve/index.html"
        title="Evolve Game"
        className="h-full w-full border-0"
      />
    </div>
  );
}
