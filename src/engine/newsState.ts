export interface NewsItem {
  uid: number;
  tick: number;
  templateId: string;
  tokens: Record<string, string>;
  variant: number;
  severity?: 1 | 2 | 3;
}

export interface NewsState {
  items: NewsItem[];
  seq: number;
  flags: Record<string, boolean>;
  cooldowns: Record<string, number>;
}

export function emptyNewsState(): NewsState {
  return { items: [], seq: 1, flags: {}, cooldowns: {} };
}
