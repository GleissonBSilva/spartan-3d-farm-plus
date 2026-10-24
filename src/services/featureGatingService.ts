import { Plan } from '@/types/saas';

export interface PlanUsageStatus {
  item: 'projetos' | 'impressoras' | 'filamentos' | 'usuarios';
  current: number;
  max: number;
  percentage: number;
  isNearLimit: boolean; // >= 80%
  isCritical: boolean; // >= 90%
  isExceeded: boolean; // >= 100%
  isUnlimited: boolean;
  message?: string;
}

export class FeatureGatingService {
  static checkUsage(
    current: number,
    max: number | undefined | null,
    itemName: PlanUsageStatus['item'],
    planName: string
  ): PlanUsageStatus {
    const isUnlimited = max === undefined || max === null || max >= 999 || !isFinite(max);
    const safeMax = isUnlimited ? 999999 : max;
    const percentage = isUnlimited ? 0 : Math.round((current / safeMax) * 100);

    const isNearLimit = !isUnlimited && percentage >= 80 && percentage < 90;
    const isCritical = !isUnlimited && percentage >= 90 && percentage < 100;
    const isExceeded = !isUnlimited && current >= safeMax;

    let message: string | undefined;
    if (isExceeded) {
      message = `Limite de ${safeMax} ${itemName} atingido no plano ${planName}. Faça um upgrade para continuar.`;
    } else if (isCritical) {
      message = `Atenção: Você atingiu ${current} de ${safeMax} ${itemName} (${percentage}% do plano ${planName}).`;
    } else if (isNearLimit) {
      message = `Aviso: Você está se aproximando do limite de ${itemName} (${current}/${safeMax}).`;
    }

    return {
      item: itemName,
      current,
      max: safeMax,
      percentage,
      isNearLimit,
      isCritical,
      isExceeded,
      isUnlimited,
      message,
    };
  }

  static canAddProject(currentCount: number, plan: Plan): { allowed: boolean; status: PlanUsageStatus } {
    const status = this.checkUsage(currentCount, plan.maxProjects, 'projetos', plan.name);
    return {
      allowed: !status.isExceeded,
      status,
    };
  }

  static canAddPrinter(currentCount: number, plan: Plan): { allowed: boolean; status: PlanUsageStatus } {
    const status = this.checkUsage(currentCount, plan.maxPrinters, 'impressoras', plan.name);
    return {
      allowed: !status.isExceeded,
      status,
    };
  }

  static canAddFilament(currentCount: number, plan: Plan): { allowed: boolean; status: PlanUsageStatus } {
    const status = this.checkUsage(currentCount, plan.maxFilaments, 'filamentos', plan.name);
    return {
      allowed: !status.isExceeded,
      status,
    };
  }
}