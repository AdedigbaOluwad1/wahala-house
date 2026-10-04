import { useEffect, useRef, useState } from "react";
import { Menu, ScrollText } from "lucide-react";
import { toast } from "sonner";
import {
  getEvent,
  getPolicy,
  pendingDecision,
  eventTokens,
  fillTokens,
} from "../../engine";
import { strings } from "../../content/strings/en";
import { useGame } from "../../store/gameStore";
import { MetricPicker } from "../hud/MetricPicker";
import { TopBar } from "../hud/TopBar";
import { MapView } from "../map/MapView";
import type { MapMarker } from "../map/MapView";
import { EventDialog } from "../modals/EventDialog";
import { NewsTicker } from "../hud/NewsTicker";
import { BudgetDialog } from "../modals/BudgetDialog";
import { PolicyMenu } from "../modals/PolicyMenu";
import { StatePanel } from "../panels/StatePanel";
import { useGameLoop } from "../useGameLoop";
import { ElectionDialog } from "../modals/ElectionDialog";
import { SystemDialog } from "../modals/SystemDialog";
import type { SystemView } from "../modals/SystemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function GameScreen({
  onExit,
  onFinished,
}: {
  onExit: () => void;
  onFinished: () => void;
}) {
  useGameLoop();
  useGame((s) => s.rev);
  const game = useGame((s) => s.game);
  const metric = useGame((s) => s.metric);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const confirmBudget = useGame((s) => s.confirmBudget);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<SystemView>("menu");
  const setPlaying = useGame((s) => s.setPlaying);
  const loadSave = useGame((s) => s.loadSave);
  const currentSave = useGame((s) => s.currentSave);
  const saveTo = useGame((s) => s.saveTo);
  const openEventUid = useGame((s) => s.openEventUid);
  const openEvent = useGame((s) => s.openEvent);
  const election = useGame((s) => s.election);
  const endTerm = useGame((s) => s.endTerm);
  const dismissElection = useGame((s) => s.dismissElection);
  const status = game.status;
  const seenLanded = useRef(game.landed.length);
  const seenEvents = useRef(new Set<number>());

  useEffect(() => {
    const fresh = game.landed.slice(seenLanded.current);
    seenLanded.current = game.landed.length;
    for (const l of fresh) {
      const name = getPolicy(l.policyId)?.name ?? l.policyId;
      if (l.phase === "side")
        toast.warning(l.note ?? strings.policies.toastSide(name), {
          description: l.note ? name : undefined,
        });
      else toast.success(strings.policies.toastMain(name));
    }
  }, [game.landed.length, game.landed]);

  useEffect(() => {
    for (const a of game.events.active) {
      if (a.severity !== 2 || seenEvents.current.has(a.uid)) continue;
      seenEvents.current.add(a.uid);
      const ev = getEvent(a.eventId);
      if (!ev) continue;
      toast.warning(
        strings.events.alert(fillTokens(ev.title, eventTokens(game, a))),
        {
          action: {
            label: strings.events.respond,
            onClick: () => openEvent(a.uid),
          },
        },
      );
    }
  }, [game, game.events.active, openEvent]);

  useEffect(() => {
    if (status.kind === "term_end") endTerm();
  }, [status.kind, endTerm]);

  useEffect(() => {
    if (!election && (status.kind === "removed" || status.kind === "finished"))
      onFinished();
  }, [status.kind, election, onFinished]);

  const decision = pendingDecision(game);
  const shownUid = decision?.uid ?? openEventUid;
  const shown = election
    ? undefined
    : game.events.active.find((a) => a.uid === shownUid);
  const markers: MapMarker[] = game.events.active
    .filter((a) => a.stateId && a.severity >= 2)
    .map((a) => {
      const ev = getEvent(a.eventId);
      const tokens = eventTokens(game, a);
      return {
        uid: a.uid,
        stateId: a.stateId!,
        severity: a.severity,
        label: strings.events.markerLabel(
          ev ? fillTokens(ev.title, tokens) : "",
          tokens.state,
        ),
      };
    });
  const flashes = game.events.history
    .filter((h) => h.stateId && game.tick - h.resolvedTick <= 2)
    .map((h) => h.stateId!);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar game={game} />
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-background">
        <MetricPicker />
        <div className="flex shrink-0 items-center gap-1 px-2">
          <label htmlFor="jump" className="sr-only">
            {strings.jumpToState}
          </label>
          <select
            id="jump"
            className="h-10 max-w-32 rounded-lg border border-input bg-card px-2 text-sm"
            value={selected ?? ""}
            onChange={(e) => select(e.target.value || null)}
          >
            <option value="">{strings.jumpToState}</option>
            {[...game.states]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setPlaying(false);
              setMenuView("menu");
              setMenuOpen(true);
            }}
            aria-label={strings.system.menu}
          >
            <Menu />
          </Button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_20rem]">
        <div className="min-h-0 min-w-0 flex-1 bg-[oklch(0.17_0.04_165)]">
          <MapView
            game={game}
            metric={metric}
            selected={selected}
            onSelect={select}
            markers={markers}
            flashes={flashes}
            onMarker={openEvent}
          />
        </div>
        <aside
          className={`border-white/10 bg-card lg:static lg:block lg:max-h-none lg:overflow-y-auto lg:border-l ${
            selected
              ? "absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-xl border-t shadow-2xl"
              : "hidden"
          }`}
          aria-label="State details"
          tabIndex={0}
        >
          <StatePanel
            game={game}
            stateId={selected}
            onClose={() => select(null)}
          />
        </aside>
      </div>
      <NewsTicker game={game} />
      <footer className="flex items-center justify-center gap-2 border-t border-white/10 bg-background p-2">
        <Button
          size="lg"
          className="w-full max-w-sm"
          onClick={() => setPoliciesOpen(true)}
        >
          <ScrollText />
          {strings.policies.open}
          {game.active.length > 0 && (
            <Badge variant="secondary">{game.active.length}</Badge>
          )}
        </Button>
      </footer>
      {shown && (
        <EventDialog
          key={shown.uid}
          game={game}
          active={shown}
          forced={shown.severity === 3}
          onDismiss={() => openEvent(null)}
        />
      )}
      {election && (
        <ElectionDialog
          result={election}
          nextTerm={game.term}
          onContinue={() => dismissElection()}
        />
      )}
      <SystemDialog
        open={menuOpen}
        view={menuView}
        onView={setMenuView}
        inGame
        onClose={() => setMenuOpen(false)}
        onLoadData={loadSave}
        currentSave={currentSave}
        saveTo={saveTo}
        onQuit={() => {
          setMenuOpen(false);
          onExit();
        }}
      />
      <PolicyMenu
        game={game}
        open={policiesOpen}
        onOpenChange={setPoliciesOpen}
      />
      {game.budgetWindowOpen &&
        !shown &&
        !election &&
        status.kind === "running" && (
          <BudgetDialog key={game.tick} game={game} onConfirm={confirmBudget} />
        )}
    </div>
  );
}
