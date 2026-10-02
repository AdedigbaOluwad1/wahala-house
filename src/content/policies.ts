import type { Policy } from '../engine/policies';
import data from './policies.json';

export const POLICIES = data as unknown as Policy[];
