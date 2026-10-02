import { Coins, GraduationCap, HeartPulse, HandCoins, Shield, Smile, Zap, Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metric } from '../store/gameStore';

export const METRIC_ICONS: Record<Metric, LucideIcon> = {
  mood: Smile,
  security: Shield,
  economy: Coins,
  power: Zap,
  health: HeartPulse,
  education: GraduationCap,
  infrastructure: Construction,
  welfare: HandCoins,
};
