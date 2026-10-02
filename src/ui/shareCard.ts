import type { Legacy } from '../engine';
import { strings } from '../content/strings/en';

const W = 1080;
const H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy + lineHeight;
}

export function tradeoffText(l: Legacy): string {
  if (l.tradeoff.kind === 'policy') return l.tradeoff.text;
  if (l.tradeoff.kind === 'budget') {
    const m = strings.metrics;
    return strings.legacy.tradeoffBudget(m[l.tradeoff.highSector], Math.round(l.tradeoff.highShare * 100), m[l.tradeoff.lowSector], Math.round(l.tradeoff.lowShare * 100));
  }
  return '';
}

export async function renderShareCard(l: Legacy): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0e3b2b');
  bg.addColorStop(1, '#06180f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f5c518';
  ctx.fillRect(60, 60, W - 120, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px system-ui, sans-serif';
  ctx.fillText(strings.appName, 60, 150);

  ctx.font = '800 76px system-ui, sans-serif';
  let y = wrap(ctx, strings.legacy.outcomes[l.outcome], 60, 270, W - 120, 88);

  ctx.fillStyle = '#f5c518';
  ctx.font = '900 190px system-ui, sans-serif';
  ctx.fillText(String(l.score), 60, y + 150);
  ctx.fillStyle = '#b6d6c6';
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.fillText(strings.legacy.score.toUpperCase(), 66, y + 210);
  y += 270;

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 40px system-ui, sans-serif';
  ctx.fillText(strings.legacy.time(l.years), 60, y);
  ctx.fillText(`${strings.legacy.avgApproval}: ${Math.round(l.avgApproval)}%`, 60, y + 56);
  ctx.fillText(strings.legacy.elections(l.electionsWon, l.electionsLost), 60, y + 112);
  y += 190;

  ctx.fillStyle = '#b6d6c6';
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText(strings.legacy.best.toUpperCase(), 60, y);
  ctx.fillText(strings.legacy.worst.toUpperCase(), 570, y);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 38px system-ui, sans-serif';
  l.best.forEach((s, i) => ctx.fillText(`${s.name}  ${Math.round(s.mood)}`, 60, y + 56 + i * 52));
  l.worst.forEach((s, i) => ctx.fillText(`${s.name}  ${Math.round(s.mood)}`, 570, y + 56 + i * 52));
  y += 260;

  const tradeoff = tradeoffText(l);
  if (tradeoff) {
    ctx.fillStyle = '#b6d6c6';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(strings.legacy.tradeoff.toUpperCase(), 60, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 40px system-ui, sans-serif';
    wrap(ctx, tradeoff, 60, y + 56, W - 120, 54);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas export failed'))), 'image/png');
  });
}
