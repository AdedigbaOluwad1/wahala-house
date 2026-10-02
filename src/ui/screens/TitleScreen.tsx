import { Landmark } from 'lucide-react';
import { strings } from '../../content/strings/en';
import { Button } from '@/components/ui/button';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="grid size-24 place-items-center rounded-3xl border-b-8 border-black/30 bg-primary text-primary-foreground shadow-xl">
        <Landmark className="size-12" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-5xl font-black tracking-tight">{strings.appName}</h1>
        <p className="mt-2 text-muted-foreground">{strings.tagline}</p>
      </div>
      <Button size="lg" className="w-full text-lg" onClick={onStart}>{strings.start}</Button>
    </section>
  );
}
