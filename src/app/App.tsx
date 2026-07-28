export function App() {
  return (
    <main className="app-shell">
      <section className="hero-band">
        <h1>Interest Manager</h1>
      </section>

      <section className="operations-grid" aria-label="Base operations">
        <button type="button">Backup</button>
        <button type="button">Restore</button>
      </section>
    </main>
  );
}
