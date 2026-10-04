import { Newspaper } from "lucide-react";
import { renderNews } from "../../engine";
import type { GameState } from "../../engine";
import { strings } from "../../content/strings/en";
import { useGame } from "../../store/gameStore";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useState } from "react";

function ToneToggle() {
  const tone = useGame((s) => s.tone);
  const setTone = useGame((s) => s.setTone);
  return (
    <label className="flex items-center gap-2 text-xs font-semibold">
      <span
        className={cn(
          tone === "dry" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {strings.news.dry}
      </span>
      <Switch
        checked={tone === "wahala"}
        onCheckedChange={(c) => setTone(c ? "wahala" : "dry")}
        aria-label={strings.news.tone}
      />
      <span
        className={cn(
          tone === "wahala" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {strings.news.wahala}
      </span>
    </label>
  );
}

export function NewsTicker({ game }: { game: GameState }) {
  const tone = useGame((s) => s.tone);
  const [open, setOpen] = useState(false);
  const latest = game.news.items[game.news.items.length - 1];
  const headline = latest ? renderNews(latest, tone) : strings.news.empty;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={strings.news.open}
        className="flex w-full items-center gap-2 border-t border-white/10 bg-card px-3 py-2 text-left text-sm"
      >
        <Newspaper
          className="size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span
          className="truncate"
          aria-live="polite"
          aria-label={strings.news.ticker}
        >
          {headline}
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[75dvh] sm:mx-auto sm:max-w-xl sm:rounded-t-xl"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Newspaper className="size-5 text-primary" aria-hidden="true" />
              {strings.news.title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {strings.news.open}
            </SheetDescription>
            <ToneToggle />
          </SheetHeader>
          <ol
            tabIndex={0}
            aria-label={strings.news.title}
            className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4"
          >
            {game.news.items.length === 0 && (
              <li className="text-muted-foreground">{strings.news.empty}</li>
            )}
            {[...game.news.items].reverse().map((n) => (
              <li
                key={n.uid}
                className={cn(
                  "rounded-xl border border-white/10 bg-card p-3",
                  n.severity === 3 && "border-destructive/50",
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {strings.news.week(n.tick)}
                </div>
                <div className="font-semibold">{renderNews(n, tone)}</div>
              </li>
            ))}
          </ol>
          <div className="px-4 pb-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {strings.closePanel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
