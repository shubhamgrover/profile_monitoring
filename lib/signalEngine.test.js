import { describe, it, expect } from 'vitest';
import { calculateCreditCost, rankSignals } from './signalEngine';

describe('Signal Engine Tests', () => {
  it('should correctly calculate credit cost based on profile count', () => {
    expect(calculateCreditCost(5)).toBe(5);
    expect(calculateCreditCost(0)).toBe(0);
  });

  it('should rank signals in the order of urgent, then week, then watch', () => {
    const mockSignals = [
      { id: '1', priority: 'watch' },
      { id: '2', priority: 'urgent' },
      { id: '3', priority: 'week' }
    ];
    const ranked = rankSignals(mockSignals);
    expect(ranked[0].priority).toBe('urgent');
    expect(ranked[1].priority).toBe('week');
    expect(ranked[2].priority).toBe('watch');
  });
});
