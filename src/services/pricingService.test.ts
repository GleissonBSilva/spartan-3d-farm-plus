import { describe, expect, it } from 'vitest';
import { PricingService } from './pricingService';

describe('PricingService', () => {
  it('calculates cost per gram and total material cost', () => {
    expect(PricingService.calculateMaterialItemCost(125, 100)).toEqual({ costPerGram: 0.1, totalCost: 12.5 });
  });

  it('includes failure, energy, depreciation, labor, and margin in project pricing', () => {
    const result = PricingService.calculateProjectPricing({
      materials: [{ id: 'm1', materialName: 'PLA', color: 'Blue', filamentType: 'PLA', weightGrams: 100, costPerGram: 0.1, totalCost: 10 }],
      printTimeHours: 2, printerPowerWatts: 350, kwhEnergyRate: 1, depreciationHourlyRate: 0.5,
      failureRatePercent: 10, laborCost: 5, otherCosts: 2, profitMarginPercent: 100,
    });
    expect(result.totalWeightGrams).toBe(100);
    expect(result.materialsWithFailureCost).toBe(11);
    expect(result.energyCost).toBe(0.7);
    expect(result.totalProductionCost).toBe(19.7);
    expect(result.suggestedPrice).toBe(39.4);
  });

  it('parses diverse time inputs to decimal hours accurately', () => {
    // Decimal numbers
    expect(PricingService.parseTimeToDecimal(1.5)).toBe(1.5);
    expect(PricingService.parseTimeToDecimal('1.5')).toBe(1.5);
    expect(PricingService.parseTimeToDecimal('1,5')).toBe(1.5);
    expect(PricingService.parseTimeToDecimal(2)).toBe(2);

    // HH:MM and HH:MM:SS format
    expect(PricingService.parseTimeToDecimal('01:30')).toBe(1.5);
    expect(PricingService.parseTimeToDecimal('02:45:00')).toBe(2.75);

    // Xh Ym format
    expect(PricingService.parseTimeToDecimal('1h30m')).toBe(1.5);
    expect(PricingService.parseTimeToDecimal('2h')).toBe(2);
    expect(PricingService.parseTimeToDecimal('45m')).toBe(0.75);

    // Edge cases
    expect(PricingService.parseTimeToDecimal('')).toBe(0);
    expect(PricingService.parseTimeToDecimal('invalid')).toBe(0);
  });

  it('formats decimal hours to standard readable string', () => {
    expect(PricingService.formatHours(1.5)).toBe('1h30m00s');
    expect(PricingService.formatHours(2)).toBe('2h00m00s');
    expect(PricingService.formatHours(0.75)).toBe('0h45m00s');
  });

  it('formats decimal hours to friendly clean UI string', () => {
    expect(PricingService.formatFriendlyHours(1.5)).toBe('1h 30m');
    expect(PricingService.formatFriendlyHours(2)).toBe('2h');
    expect(PricingService.formatFriendlyHours(0.75)).toBe('45m');
    expect(PricingService.formatFriendlyHours(0)).toBe('0h');
  });
});
