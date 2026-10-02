import { strings } from '../../content/strings/en';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-4 text-center">
      <h1 className="text-4xl font-bold">{strings.appName}</h1>
      <p className="text-emerald-100">{strings.tagline}</p>
      <button className="rounded-lg bg-white px-6 py-3 font-semibold text-emerald-950" onClick={onStart}>
        {strings.start}
      </button>
    </section>
  );
}
