import { describe, expect, it } from 'vitest';
import { FeatureGatingService } from './featureGatingService';
import { Plan } from '@/types/saas';

const plan: Plan = {
  id: 'test', name: 'Test', description: '', priceMonthly: 10, priceYearly: 100, features: [],
  maxProjects: 10, maxPrinters: 2, maxFilaments: 5, maxUsers: 1,
};

describe('FeatureGatingService', () => {
  it('warns at 80 percent usage and blocks at the limit', () => {
    const near = FeatureGatingService.canAddProject(8, plan);
    const full = FeatureGatingService.canAddProject(10, plan);
    expect(near.allowed).toBe(true);
    expect(near.status.isNearLimit).toBe(true);
    expect(full.allowed).toBe(false);
    expect(full.status.isExceeded).toBe(true);
  });

  it('treats the plan unlimited threshold consistently', () => {
    const status = FeatureGatingService.checkUsage(10000, 9999, 'projetos', 'Business');
    expect(status.isUnlimited).toBe(true);
    expect(status.isExceeded).toBe(false);
  });
});
