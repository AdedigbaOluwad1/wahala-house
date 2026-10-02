import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { DEFAULT_CONFIG } from '../../engine/state';
import type { GameConfig } from '../../engine/state';
import { strings } from '../../content/strings/en';
import { useSettings } from '../../store/settingsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const s = strings.setup;

function Group<T extends string | number>({ label, value, options, onChange, help }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-3">
      <div className="font-extrabold">{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={String(o.value)} variant="secondary" size="sm" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </Button>
        ))}
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export function SetupScreen({ onStart, onBack }: { onStart: (config: GameConfig) => void; onBack: () => void }) {
  const defaults = useSettings((st) => st.settings);
  const [config, setConfig] = useState<GameConfig>({ ...DEFAULT_CONFIG, tone: defaults.tone, speed: defaults.speed, seed: '' });
  const set = <K extends keyof GameConfig>(k: K, v: GameConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));

  return (
    <section className="mx-auto flex min-h-dvh max-w-lg flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={s.back}><ArrowLeft /></Button>
        <div>
          <h1 className="text-2xl font-black">{s.title}</h1>
          <p className="text-sm text-muted-foreground">{s.intro}</p>
        </div>
      </div>

      <Group
        label={s.mode}
        value={config.mode}
        options={[{ value: 'term', label: s.modes.term }, { value: 'survival', label: s.modes.survival }]}
        onChange={(v) => set('mode', v)}
        help={s.modeHelp[config.mode]}
      />
      {config.mode === 'term' && (
        <>
          <Group
            label={s.termLength}
            value={config.termYears}
            options={([2, 4, 6] as const).map((y) => ({ value: y, label: s.years(y) }))}
            onChange={(v) => set('termYears', v)}
          />
          <Group
            label={s.termsAllowed}
            value={String(config.termsAllowed)}
            options={[{ value: '1', label: s.terms[1] }, { value: '2', label: s.terms[2] }, { value: 'unlimited', label: s.terms.unlimited }]}
            onChange={(v) => set('termsAllowed', v === 'unlimited' ? 'unlimited' : (Number(v) as 1 | 2))}
          />
        </>
      )}
      <Group
        label={s.difficulty}
        value={config.difficulty}
        options={(['easy', 'realistic', 'brutal'] as const).map((d) => ({ value: d, label: s.difficulties[d] }))}
        onChange={(v) => set('difficulty', v)}
        help={s.difficultyHelp[config.difficulty]}
      />
      <Group
        label={s.speed}
        value={config.speed}
        options={(['slow', 'normal', 'fast'] as const).map((v) => ({ value: v, label: strings.speed[v] }))}
        onChange={(v) => set('speed', v)}
      />
      <Group
        label={s.tone}
        value={config.tone}
        options={[{ value: 'dry', label: strings.news.dry }, { value: 'wahala', label: strings.news.wahala }]}
        onChange={(v) => set('tone', v)}
      />
      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-3">
        <Label htmlFor="seed" className="font-extrabold">{s.seed}</Label>
        <Input id="seed" value={config.seed ?? ''} placeholder={s.seedPlaceholder} onChange={(e) => set('seed', e.target.value)} />
        <p className="text-xs text-muted-foreground">{s.seedHelp}</p>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-white/10 bg-background p-4">
        <Button size="lg" variant="success" className="w-full text-lg" onClick={() => onStart({ ...config, seed: config.seed?.trim() || undefined })}>
          {s.start}
        </Button>
      </div>
    </section>
  );
}
