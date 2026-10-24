export type PaymentMethodType = 'pix' | 'credito' | 'debito' | 'dinheiro';

export interface PaymentMethodItemConfig {
  enabled: boolean;
  name: string;
  type: PaymentMethodType;
  discountPercent?: number; // Desconto em % (ex: 5 para PIX ou Dinheiro)
  feePercent?: number;      // Taxa em % (ex: 3.5 para Crédito ou Débito)
  maxInstallments?: number; // Para crédito (ex: 12)
  installmentsWithoutInterest?: number; // Parcelas sem juros (ex: 3)
}

export interface FarmPaymentSettings {
  pixKeyType: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  pixKey: string;
  pixBeneficiary: string;
  downPaymentPercent: number; // Porcentagem padrão de sinal para início (ex: 50%)
  pixDiscountPercent?: number;
  cashDiscountPercent?: number;
  methods: {
    pix: PaymentMethodItemConfig;
    credito: PaymentMethodItemConfig;
    debito: PaymentMethodItemConfig;
    dinheiro: PaymentMethodItemConfig;
  };
}

export interface PaymentCalculationResult {
  method: PaymentMethodType;
  methodName: string;
  originalPrice: number;
  adjustmentAmount: number; // Valor em R$ do desconto (-) ou taxa (+)
  adjustmentType: 'discount' | 'fee' | 'none';
  adjustmentPercent: number;
  finalPrice: number;
  installments: number;
  installmentValue: number;
  downPaymentPercent: number;
  downPaymentAmount: number; // Valor de entrada (sinal)
  balanceAmount: number;     // Valor restante na entrega
  summaryText: string;
}

import { supabase } from '@/lib/supabase';

export const DEFAULT_PAYMENT_SETTINGS: FarmPaymentSettings = {
  pixKeyType: 'telefone',
  pixKey: '',
  pixBeneficiary: '',
  downPaymentPercent: 50,
  pixDiscountPercent: 5,
  cashDiscountPercent: 5,
  methods: {
    pix: {
      enabled: true,
      name: 'Pix Instantâneo',
      type: 'pix',
      discountPercent: 5, // 5% de desconto padrão no Pix
      feePercent: 0,
    },
    credito: {
      enabled: true,
      name: 'Cartão de Crédito',
      type: 'credito',
      discountPercent: 0,
      feePercent: 0,
      maxInstallments: 12,
      installmentsWithoutInterest: 3,
    },
    debito: {
      enabled: true,
      name: 'Cartão de Débito',
      type: 'debito',
      discountPercent: 0,
      feePercent: 0,
    },
    dinheiro: {
      enabled: true,
      name: 'Dinheiro em Espécie',
      type: 'dinheiro',
      discountPercent: 5,
      feePercent: 0,
    },
  },
};

const STORAGE_KEY_PREFIX = 'spartan_payment_methods_config';

function cloneDefaultPaymentSettings(): FarmPaymentSettings {
  return {
    ...DEFAULT_PAYMENT_SETTINGS,
    pixKey: '',
    pixBeneficiary: '',
    methods: {
      pix: { ...DEFAULT_PAYMENT_SETTINGS.methods.pix },
      credito: { ...DEFAULT_PAYMENT_SETTINGS.methods.credito },
      debito: { ...DEFAULT_PAYMENT_SETTINGS.methods.debito },
      dinheiro: { ...DEFAULT_PAYMENT_SETTINGS.methods.dinheiro },
    },
  };
}

export class PaymentMethodsService {
  private static currentUserId: string | null = null;

  static setCurrentUser(userId: string | null): void {
    this.currentUserId = userId;
    try {
      // Remove chave legada global sem escopo de usuário para impedir vazamento entre sessões
      localStorage.removeItem(STORAGE_KEY_PREFIX);
    } catch {
      // ignore storage errors
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('spartan_payment_settings_updated', { detail: { userId } })
      );
    }
  }

  private static getScopedKey(userId?: string | null): string | null {
    const resolvedId = userId !== undefined ? userId : this.currentUserId;
    if (!resolvedId) return null;
    return `${STORAGE_KEY_PREFIX}_${resolvedId}`;
  }

  private static normalizeSettings(parsed: Partial<FarmPaymentSettings> | null | undefined): FarmPaymentSettings {
    const base = cloneDefaultPaymentSettings();
    if (!parsed || typeof parsed !== 'object') {
      return base;
    }
    const methods = {
      pix: { ...base.methods.pix, ...(parsed.methods?.pix || {}) },
      credito: { ...base.methods.credito, ...(parsed.methods?.credito || {}) },
      debito: { ...base.methods.debito, ...(parsed.methods?.debito || {}) },
      dinheiro: { ...base.methods.dinheiro, ...(parsed.methods?.dinheiro || {}) },
    };
    const pixDiscount = methods.pix?.discountPercent ?? parsed.pixDiscountPercent ?? 5;
    const cashDiscount = methods.dinheiro?.discountPercent ?? parsed.cashDiscountPercent ?? 5;

    return {
      ...base,
      ...parsed,
      pixKey: typeof parsed.pixKey === 'string' ? parsed.pixKey : '',
      pixBeneficiary: typeof parsed.pixBeneficiary === 'string' ? parsed.pixBeneficiary : '',
      pixDiscountPercent: pixDiscount,
      cashDiscountPercent: cashDiscount,
      methods,
    };
  }

  /**
   * Obtém as configurações de formas de pagamento salvas exclusivamente para o usuário informado
   */
  static getSettings(userId?: string | null): FarmPaymentSettings {
    try {
      const storageKey = this.getScopedKey(userId);
      if (!storageKey) {
        return cloneDefaultPaymentSettings();
      }
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return this.normalizeSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Erro ao ler configurações de pagamento do localStorage:', e);
    }
    return cloneDefaultPaymentSettings();
  }

  /**
   * Alias compatível para getSettings
   */
  static loadPaymentSettings(userId?: string | null): FarmPaymentSettings {
    return this.getSettings(userId);
  }

  /**
   * Sincroniza configurações de pagamento do banco de dados Supabase (isoladas estritamente por user_id)
   */
  static async syncFromSupabase(userId: string): Promise<FarmPaymentSettings> {
    if (!userId) return cloneDefaultPaymentSettings();
    this.currentUserId = userId;
    if (!supabase) return this.getSettings(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData?.session?.user?.id;
      if (sessionUserId && sessionUserId !== userId) {
        return cloneDefaultPaymentSettings();
      }

      const { data, error } = await supabase
        .from('spartan_user_settings')
        .select('user_id, payment_settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error) {
        const storageKey = this.getScopedKey(userId);
        if (
          data &&
          data.user_id === userId &&
          data.payment_settings &&
          Object.keys(data.payment_settings as object).length > 0
        ) {
          const normalized = this.normalizeSettings(data.payment_settings as Partial<FarmPaymentSettings>);
          if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('spartan_payment_settings_updated', { detail: { userId } })
            );
          }
          return normalized;
        } else {
          // Banco confirma que este usuário ainda não tem configurações salvas: garante estado limpo
          const clean = cloneDefaultPaymentSettings();
          if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(clean));
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('spartan_payment_settings_updated', { detail: { userId } })
            );
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn('Não foi possível sincronizar configurações de pagamento do Supabase:', e);
    }
    return this.getSettings(userId);
  }

  /**
   * Salva as configurações de formas de pagamento de maneira isolada para o usuário ativo
   */
  static saveSettings(settings: FarmPaymentSettings, userId?: string | null): boolean {
    try {
      const effectiveUserId = userId !== undefined ? userId : this.currentUserId;
      if (!effectiveUserId) {
        return false;
      }
      const storageKey = this.getScopedKey(effectiveUserId);
      const normalized = this.normalizeSettings(settings);

      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
      }

      if (supabase) {
        void supabase.auth.getSession().then(({ data: sessionData }) => {
          const activeAuthId = sessionData?.session?.user?.id;
          // Jamais persiste no banco se o token ativo não pertencer exatamente ao effectiveUserId
          if (!activeAuthId || activeAuthId !== effectiveUserId) {
            return;
          }
          void Promise.resolve(
            supabase!
              .from('spartan_user_settings')
              .upsert(
                {
                  user_id: effectiveUserId,
                  payment_settings: normalized,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
              )
          ).catch(err => console.warn('Erro ao persistir payment_settings no Supabase:', err));
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('spartan_payment_settings_updated', { detail: { userId: effectiveUserId } })
        );
      }
      return true;
    } catch (e) {
      console.error('Erro ao salvar configurações de pagamento:', e);
      return false;
    }
  }

  /**
   * Alias compatível para saveSettings
   */
  static savePaymentSettings(settings: FarmPaymentSettings, userId?: string | null): boolean {
    return this.saveSettings(settings, userId);
  }

  /**
   * Calcula o impacto financeiro da forma de pagamento selecionada no preço do orçamento
   */
  static calculatePaymentEffect(
    basePrice: number,
    method: PaymentMethodType = 'pix',
    installments = 1,
    customSettings?: FarmPaymentSettings
  ): PaymentCalculationResult {
    const settings = customSettings || this.getSettings();
    const methodConfig = settings.methods[method] || settings.methods.pix;
    const safePrice = Math.max(0, Number(basePrice) || 0);

    let adjustmentAmount = 0;
    let adjustmentType: 'discount' | 'fee' | 'none' = 'none';
    let adjustmentPercent = 0;

    if (safePrice > 0) {
      if ((methodConfig.discountPercent || 0) > 0) {
        adjustmentPercent = methodConfig.discountPercent || 0;
        adjustmentAmount = -Number(((safePrice * adjustmentPercent) / 100).toFixed(2));
        adjustmentType = 'discount';
      } else if ((methodConfig.feePercent || 0) > 0) {
        adjustmentPercent = methodConfig.feePercent || 0;
        adjustmentAmount = Number(((safePrice * adjustmentPercent) / 100).toFixed(2));
        adjustmentType = 'fee';
      }
    }

    const finalPrice = Math.max(0, Number((safePrice + adjustmentAmount).toFixed(2)));

    // Parcelamento (apenas para crédito)
    const safeInstallments = method === 'credito' ? Math.max(1, Math.min(installments || 1, methodConfig.maxInstallments || 12)) : 1;
    const installmentValue = safeInstallments > 0 ? Number((finalPrice / safeInstallments).toFixed(2)) : finalPrice;

    // Sinal de entrada (down payment)
    const downPercent = Math.max(0, Math.min(100, settings.downPaymentPercent || 50));
    const downPaymentAmount = Number(((finalPrice * downPercent) / 100).toFixed(2));
    const balanceAmount = Number((finalPrice - downPaymentAmount).toFixed(2));

    // Resumo textual
    let summaryText = '';
    if (method === 'pix') {
      summaryText = adjustmentPercent > 0 
        ? `Desconto Pix de ${adjustmentPercent}% aplicado (- R$ ${Math.abs(adjustmentAmount).toFixed(2)})`
        : 'Pagamento instantâneo via Pix';
    } else if (method === 'credito') {
      summaryText = safeInstallments > 1 
        ? `${safeInstallments}x de R$ ${installmentValue.toFixed(2)}`
        : '1x no Cartão de Crédito à vista';
    } else if (method === 'debito') {
      summaryText = 'Cartão de Débito à vista';
    } else if (method === 'dinheiro') {
      summaryText = adjustmentPercent > 0 
        ? `Desconto em dinheiro de ${adjustmentPercent}% (- R$ ${Math.abs(adjustmentAmount).toFixed(2)})`
        : 'Dinheiro em espécie no ato da entrega';
    }

    return {
      method,
      methodName: methodConfig.name,
      originalPrice: safePrice,
      adjustmentAmount,
      adjustmentType,
      adjustmentPercent,
      finalPrice,
      installments: safeInstallments,
      installmentValue,
      downPaymentPercent: downPercent,
      downPaymentAmount,
      balanceAmount,
      summaryText,
    };
  }

  /**
   * Retorna texto amigável com ícone para exibição rápida
   */
  static formatPaymentLabel(method: PaymentMethodType = 'pix', installments = 1): string {
    switch (method) {
      case 'pix':
        return 'Pix Instantâneo';
      case 'credito':
        return installments > 1 ? `Crédito (${installments}x)` : 'Crédito à vista';
      case 'debito':
        return 'Cartão de Débito';
      case 'dinheiro':
        return 'Dinheiro em Espécie';
      default:
        return 'Pix';
    }
  }
}
