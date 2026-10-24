import { ProjectMaterial, MaterialVariation } from '@/types/saas';

export interface PricingCalculationInput {
  materials: ProjectMaterial[];
  printTimeHours: number;
  printerPowerWatts: number;
  kwhEnergyRate: number;
  depreciationHourlyRate: number;
  failureRatePercent: number;
  laborCost: number;
  otherCosts?: number;
  profitMarginPercent: number;
}

export interface PricingCalculationResult {
  totalWeightGrams: number;
  materialsBaseCost: number;
  materialsWithFailureCost: number;
  kwhTotal: number;
  energyCost: number;
  depreciationCost: number;
  laborCost: number;
  otherCosts: number;
  totalProductionCost: number;
  suggestedPrice: number;
  estimatedProfit: number;
  marginRealPercent: number;
}

export class PricingService {
  /**
   * Sanitiza qualquer valor numérico para evitar NaN, Infinity ou negativos
   */
  private static sanitizeNumber(val: unknown, fallback = 0, min = 0): number {
    const parsed = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(parsed) || !isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
  }

  /**
   * Converte formato de tempo (número decimal, HH:MM, HH:MM:SS, "1h30m", "45m") para horas decimais reais
   */
  static parseTimeToDecimal(val: string | number): number {
    if (typeof val === 'number') {
      return isNaN(val) || !isFinite(val) ? 0 : Math.max(0, val);
    }
    
    if (!val) return 0;
    
    const clean = String(val).trim();
    
    // Formato HH:MM ou HH:MM:SS (ex: "01:30" ou "2:45:00")
    if (clean.includes(':')) {
      const parts = clean.split(':');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;
      return Math.max(0, hours + (minutes / 60) + (seconds / 3600));
    }

    // Formato "1h30m", "2h", "45m"
    const hmMatch = clean.match(/^(?:(\d+(?:[.,]\d+)?)\s*h(?:oras?)?)?\s*(?:(\d+(?:[.,]\d+)?)\s*m(?:in(?:utos?)?)?)?$/i);
    if (hmMatch && (hmMatch[1] || hmMatch[2])) {
      const hours = parseFloat((hmMatch[1] || '0').replace(',', '.')) || 0;
      const minutes = parseFloat((hmMatch[2] || '0').replace(',', '.')) || 0;
      return Math.max(0, hours + (minutes / 60));
    }
    
    // Número decimal padrão (ex: "1.5" ou "1,5")
    const num = parseFloat(clean.replace(',', '.'));
    return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
  }

  /**
   * Formata horas decimais para string amigável (ex: 1.5 -> "1h30m00s")
   */
  static formatHours(decimalHours: number): string {
    const safeValue = Math.max(0, decimalHours);
    const hours = Math.floor(safeValue);
    const minutes = Math.round((safeValue - hours) * 60);
    const seconds = 0;
    return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
  }

  /**
   * Formata horas decimais para exibição limpa em UI (ex: 1.5 -> "1h 30m", 0.75 -> "45m", 2 -> "2h")
   */
  static formatFriendlyHours(decimalHours: number): string {
    const safeValue = Math.max(0, decimalHours);
    if (safeValue === 0) return '0h';
    const totalMinutes = Math.round(safeValue * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  /**
   * Calcula o custo individual de um material com base no peso e preço do carretel
   */
  static calculateMaterialItemCost(
    weightGrams: number,
    pricePerKg: number
  ): { costPerGram: number; totalCost: number } {
    const validWeight = this.sanitizeNumber(weightGrams, 0, 0);
    const validPrice = this.sanitizeNumber(pricePerKg, 0, 0);

    const costPerGram = validPrice > 0 ? validPrice / 1000 : 0;
    const totalCost = validWeight * costPerGram;

    return {
      costPerGram: Number(costPerGram.toFixed(4)),
      totalCost: Number(totalCost.toFixed(2)),
    };
  }

  /**
   * Motor de precificação consolidado com múltiplos materiais (1 a 4 cores)
   */
  static calculateProjectPricing(input: PricingCalculationInput): PricingCalculationResult {
    const rawMaterials = Array.isArray(input.materials) ? input.materials.slice(0, 4) : [];
    const printTimeHours = this.sanitizeNumber(input.printTimeHours, 0.1, 0);
    const printerPowerWatts = this.sanitizeNumber(input.printerPowerWatts, 350, 0);
    const kwhEnergyRate = this.sanitizeNumber(input.kwhEnergyRate, 0.85, 0);
    const depreciationHourlyRate = this.sanitizeNumber(input.depreciationHourlyRate, 0.5, 0);
    const failureRatePercent = this.sanitizeNumber(input.failureRatePercent, 0, 0);
    const laborCost = this.sanitizeNumber(input.laborCost, 0, 0);
    const otherCosts = this.sanitizeNumber(input.otherCosts, 0, 0);
    const profitMarginPercent = this.sanitizeNumber(input.profitMarginPercent, 100, 0);

    // 1. Materiais (máximo 4 validados)
    let totalWeightGrams = 0;
    let materialsBaseCost = 0;

    rawMaterials.forEach(m => {
      const w = this.sanitizeNumber(m.weightGrams, 0, 0);
      const c = this.sanitizeNumber(m.costPerGram, 0, 0);
      totalWeightGrams += w;
      materialsBaseCost += w * c;
    });

    const failureMultiplier = 1 + failureRatePercent / 100;
    const materialsWithFailureCost = materialsBaseCost * failureMultiplier;

    // 2. Consumo Elétrico (Watts / 1000 * Horas * Tarifa)
    const powerKw = printerPowerWatts / 1000;
    const kwhTotal = powerKw * printTimeHours;
    const energyCost = kwhTotal * kwhEnergyRate;

    // 3. Depreciação / Desgaste de bico e mecânica
    const depreciationCost = printTimeHours * depreciationHourlyRate;

    // 4. Custo total de fabricação (Custo Real de Produção)
    const totalProductionCost =
      materialsWithFailureCost + energyCost + depreciationCost + laborCost + otherCosts;

    // 5. Preço Sugerido (Markup de Margem sobre o Custo de Produção)
    const suggestedPrice = totalProductionCost * (1 + profitMarginPercent / 100);
    const estimatedProfit = Math.max(0, suggestedPrice - totalProductionCost);
    const marginRealPercent = suggestedPrice > 0 ? (estimatedProfit / suggestedPrice) * 100 : 0;

    return {
      totalWeightGrams: Number(totalWeightGrams.toFixed(1)),
      materialsBaseCost: Number(materialsBaseCost.toFixed(2)),
      materialsWithFailureCost: Number(materialsWithFailureCost.toFixed(2)),
      kwhTotal: Number(kwhTotal.toFixed(2)),
      energyCost: Number(energyCost.toFixed(2)),
      depreciationCost: Number(depreciationCost.toFixed(2)),
      laborCost: Number(laborCost.toFixed(2)),
      otherCosts: Number(otherCosts.toFixed(2)),
      totalProductionCost: Number(totalProductionCost.toFixed(2)),
      suggestedPrice: Number(suggestedPrice.toFixed(2)),
      estimatedProfit: Number(estimatedProfit.toFixed(2)),
      marginRealPercent: Number(marginRealPercent.toFixed(1)),
    };
  }

  /**
   * Gera simulações comparativas completas de 1 a 4 cores mesmo se o projeto tiver menos materiais cadastrados inicialmente
   */
  static generateMaterialVariations(
    baseMaterials: ProjectMaterial[],
    baseInput: Omit<PricingCalculationInput, 'materials'>
  ): MaterialVariation[] {
    const variations: MaterialVariation[] = [];
    const validMaterials = (baseMaterials || []).slice(0, 4);

    if (validMaterials.length === 0) return variations;

    const primaryMat = validMaterials[0];
    const totalWeight = Math.max(
      10,
      validMaterials.reduce((acc, m) => acc + this.sanitizeNumber(m.weightGrams, 0), 0)
    );

    const baseCostPerGram = primaryMat.costPerGram || 0.095;

    // 1 Cor (Monocromática)
    const mat1: ProjectMaterial = {
      ...primaryMat,
      weightGrams: totalWeight,
      totalCost: Number((totalWeight * baseCostPerGram).toFixed(2)),
    };
    const res1 = this.calculateProjectPricing({ ...baseInput, materials: [mat1] });
    variations.push({
      id: 'var_1',
      name: '1 Cor (Monocromática)',
      colorCount: 1,
      materials: [mat1],
      totalWeightGrams: res1.totalWeightGrams,
      materialsCost: res1.materialsWithFailureCost,
      energyCost: res1.energyCost,
      depreciationCost: res1.depreciationCost,
      laborCost: res1.laborCost,
      totalCost: res1.totalProductionCost,
      suggestedPrice: res1.suggestedPrice,
      estimatedProfit: res1.estimatedProfit,
    });

    // 2 Cores
    const mat2A: ProjectMaterial = validMaterials[0]
      ? { ...validMaterials[0], weightGrams: Math.round(totalWeight * 0.65) }
      : { ...mat1, weightGrams: Math.round(totalWeight * 0.65) };
    const mat2B: ProjectMaterial = validMaterials[1]
      ? { ...validMaterials[1], weightGrams: Math.round(totalWeight * 0.35) }
      : {
          id: 'mat_var_2',
          materialName: 'PLA Branco',
          color: 'Branco Neve',
          colorHex: '#f8fafc',
          filamentType: 'PLA',
          weightGrams: Math.round(totalWeight * 0.35),
          costPerGram: 0.105,
          totalCost: Number((Math.round(totalWeight * 0.35) * 0.105).toFixed(2)),
        };

    const mats2 = [mat2A, mat2B];
    const res2 = this.calculateProjectPricing({ ...baseInput, materials: mats2 });
    variations.push({
      id: 'var_2',
      name: '2 Cores (Destaque)',
      colorCount: 2,
      materials: mats2,
      totalWeightGrams: res2.totalWeightGrams,
      materialsCost: res2.materialsWithFailureCost,
      energyCost: res2.energyCost,
      depreciationCost: res2.depreciationCost,
      laborCost: res2.laborCost,
      totalCost: res2.totalProductionCost,
      suggestedPrice: res2.suggestedPrice,
      estimatedProfit: res2.estimatedProfit,
    });

    // 3 Cores
    const mat3A: ProjectMaterial = { ...mat2A, weightGrams: Math.round(totalWeight * 0.5) };
    const mat3B: ProjectMaterial = { ...mat2B, weightGrams: Math.round(totalWeight * 0.3) };
    const mat3C: ProjectMaterial = validMaterials[2]
      ? { ...validMaterials[2], weightGrams: Math.round(totalWeight * 0.2) }
      : {
          id: 'mat_var_3',
          materialName: 'PETG Vermelho',
          color: 'Vermelho',
          colorHex: '#ef4444',
          filamentType: 'PETG',
          weightGrams: Math.round(totalWeight * 0.2),
          costPerGram: 0.115,
          totalCost: Number((Math.round(totalWeight * 0.2) * 0.115).toFixed(2)),
        };

    const mats3 = [mat3A, mat3B, mat3C];
    const res3 = this.calculateProjectPricing({ ...baseInput, materials: mats3 });
    variations.push({
      id: 'var_3',
      name: '3 Cores (Multicolor)',
      colorCount: 3,
      materials: mats3,
      totalWeightGrams: res3.totalWeightGrams,
      materialsCost: res3.materialsWithFailureCost,
      energyCost: res3.energyCost,
      depreciationCost: res3.depreciationCost,
      laborCost: res3.laborCost,
      totalCost: res3.totalProductionCost,
      suggestedPrice: res3.suggestedPrice,
      estimatedProfit: res3.estimatedProfit,
    });

    // 4 Cores (AMS Full)
    const mat4A: ProjectMaterial = { ...mat3A, weightGrams: Math.round(totalWeight * 0.4) };
    const mat4B: ProjectMaterial = { ...mat3B, weightGrams: Math.round(totalWeight * 0.3) };
    const mat4C: ProjectMaterial = { ...mat3C, weightGrams: Math.round(totalWeight * 0.15) };
    const mat4D: ProjectMaterial = validMaterials[3]
      ? { ...validMaterials[3], weightGrams: Math.round(totalWeight * 0.15) }
      : {
          id: 'mat_var_4',
          materialName: 'PETG Azul',
          color: 'Azul Cobalto',
          colorHex: '#2563eb',
          filamentType: 'PETG',
          weightGrams: Math.round(totalWeight * 0.15),
          costPerGram: 0.11,
          totalCost: Number((Math.round(totalWeight * 0.15) * 0.11).toFixed(2)),
        };

    const mats4 = [mat4A, mat4B, mat4C, mat4D];
    const res4 = this.calculateProjectPricing({ ...baseInput, materials: mats4 });
    variations.push({
      id: 'var_4',
      name: '4 Cores (AMS / Multimaterial Full)',
      colorCount: 4,
      materials: mats4,
      totalWeightGrams: res4.totalWeightGrams,
      materialsCost: res4.materialsWithFailureCost,
      energyCost: res4.energyCost,
      depreciationCost: res4.depreciationCost,
      laborCost: res4.laborCost,
      totalCost: res4.totalProductionCost,
      suggestedPrice: res4.suggestedPrice,
      estimatedProfit: res4.estimatedProfit,
    });

    return variations;
  }
}