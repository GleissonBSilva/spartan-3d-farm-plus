/**
 * Utilitário para geração de Payload Pix (EMV BR Code Padrão Banco Central)
 * Permite gerar códigos Pix "Copia e Cola" e QR Codes válidos para qualquer banco brasileiro.
 * Persiste a chave Pix de forma definitiva no Supabase (spartan_user_settings) e em cache local.
 */

import { supabase } from '@/lib/supabase';

export interface PixConfig {
  chave: string;
  tipoChave: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  nomeTitular: string;
  cidade: string;
}

export interface PixChargeParams {
  chave: string;
  nomeTitular: string;
  cidade: string;
  valor: number;
  txId?: string;
  descricao?: string;
}

const DEFAULT_CONFIG_KEY_PREFIX = 'spartan_pix_config_';
const pixConfigMemoryCache = new Map<string, PixConfig>();

export const DEFAULT_PIX_CONFIG: PixConfig = {
  chave: 'gsroboticmania@gmail.com',
  tipoChave: 'email',
  nomeTitular: 'SPARTAN 3D',
  cidade: 'MANAUS',
};

export function getSavedPixConfig(userId?: string | null): PixConfig {
  if (!userId) {
    if (typeof localStorage !== 'undefined') {
      try {
        const plat = localStorage.getItem('spartan_platform_pix_config');
        if (plat) {
          const parsed = JSON.parse(plat);
          if (parsed.chave) return { ...DEFAULT_PIX_CONFIG, ...parsed };
        }
      } catch {}
    }
    return { ...DEFAULT_PIX_CONFIG };
  }
  if (pixConfigMemoryCache.has(userId)) {
    return { ...DEFAULT_PIX_CONFIG, ...pixConfigMemoryCache.get(userId)! };
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`${DEFAULT_CONFIG_KEY_PREFIX}${userId}`);
      if (saved) {
        const parsed = { ...DEFAULT_PIX_CONFIG, ...JSON.parse(saved) };
        pixConfigMemoryCache.set(userId, parsed);
        return parsed;
      }
      const plat = localStorage.getItem('spartan_platform_pix_config');
      if (plat) {
        const parsed = { ...DEFAULT_PIX_CONFIG, ...JSON.parse(plat) };
        if (parsed.chave) return parsed;
      }
    }
  } catch (error) {
    console.warn('Não foi possível recuperar configuração Pix salva:', error);
  }
  return { ...DEFAULT_PIX_CONFIG };
}

/**
 * Recupera a configuração Pix oficial da plataforma para qualquer assinante pagar faturas
 */
export async function getPlatformPixConfig(): Promise<PixConfig> {
  // 1. Tenta carregar do cache local
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('spartan_platform_pix_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.chave && parsed.chave.trim()) {
          return { ...DEFAULT_PIX_CONFIG, ...parsed };
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('spartan_pix_config_')) {
          const val = JSON.parse(localStorage.getItem(key) || '{}');
          if (val.chave && val.chave.trim()) {
            return { ...DEFAULT_PIX_CONFIG, ...val };
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Busca do Supabase via RPC segura
  try {
    if (supabase) {
      const { data, error } = await supabase.rpc('spartan_get_platform_pix_config');
      if (!error && data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        const chave = String(obj.chave || '').trim();
        if (chave) {
          const cfg: PixConfig = {
            chave,
            tipoChave: (obj.tipoChave as PixConfig['tipoChave']) || 'email',
            nomeTitular: String(obj.nomeTitular || 'SPARTAN 3D').trim(),
            cidade: String(obj.cidade || 'MANAUS').trim(),
          };
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('spartan_platform_pix_config', JSON.stringify(cfg));
          }
          return cfg;
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao obter chave Pix da plataforma do Supabase:', err);
  }

  return { ...DEFAULT_PIX_CONFIG };
}

/**
 * Sincroniza a configuração Pix salva na nuvem (Supabase) para o usuário
 */
export async function syncPixConfigFromSupabase(userId: string): Promise<PixConfig> {
  if (!userId) return getSavedPixConfig(userId);
  try {
    if (!supabase) return getSavedPixConfig(userId);
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    if (sessionUserId && sessionUserId !== userId) {
      return getSavedPixConfig(userId);
    }

    const { data, error } = await supabase
      .from('spartan_user_settings')
      .select('payment_settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data?.payment_settings) {
      const ps = data.payment_settings as Record<string, unknown>;
      const adminPix = ps.admin_pix as Partial<PixConfig> | undefined;
      const chave = String(adminPix?.chave || ps.pixKey || '').trim();
      const nomeTitular = String(adminPix?.nomeTitular || ps.pixBeneficiary || '').trim();
      const tipoChave = (adminPix?.tipoChave || ps.pixKeyType || 'telefone') as PixConfig['tipoChave'];
      const cidade = String(adminPix?.cidade || ps.pixCity || 'MANAUS').trim();

      if (chave) {
        const merged: PixConfig = {
          chave,
          tipoChave,
          nomeTitular,
          cidade,
        };
        pixConfigMemoryCache.set(userId, merged);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`${DEFAULT_CONFIG_KEY_PREFIX}${userId}`, JSON.stringify(merged));
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('Erro ao sincronizar Pix do Supabase:', err);
  }
  return getSavedPixConfig(userId);
}

/**
 * Salva a configuração Pix tanto no localStorage quanto no banco de dados Supabase de forma permanente
 */
export async function savePixConfig(config: PixConfig, userId?: string | null): Promise<void> {
  try {
    if (!userId) return;
    pixConfigMemoryCache.set(userId, { ...config });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${DEFAULT_CONFIG_KEY_PREFIX}${userId}`, JSON.stringify(config));
      localStorage.setItem('spartan_platform_pix_config', JSON.stringify(config));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('spartan_pix_config_updated', { detail: { config, userId } })
      );
    }

    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData?.session?.user?.id;
      if (!sessionUserId || sessionUserId !== userId) return;

      const { data: existing } = await supabase
        .from('spartan_user_settings')
        .select('payment_settings')
        .eq('user_id', userId)
        .maybeSingle();

      const existingPayment = (existing?.payment_settings as Record<string, unknown>) || {};
      const updatedPayment = {
        ...existingPayment,
        admin_pix: config,
        pixKey: config.chave,
        pixBeneficiary: config.nomeTitular,
        pixKeyType: config.tipoChave,
        pixCity: config.cidade,
      };

      await supabase
        .from('spartan_user_settings')
        .upsert(
          {
            user_id: userId,
            payment_settings: updatedPayment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }
  } catch (error) {
    console.warn('Não foi possível salvar configuração Pix:', error);
  }
}

/**
 * Normaliza e valida a chave Pix de acordo com as regras estritas do Banco Central do Brasil:
 * - Telefone: deve ter formato internacional E.164 com DDI +55 (ex: +5592991463640)
 * - CPF: exatamente 11 dígitos numéricos sem pontuação
 * - CNPJ: exatamente 14 dígitos numéricos sem pontuação
 * - E-mail: minúsculo, sem espaços
 * - Aleatória (EVP): formato UUID minúsculo, sem espaços
 */
export function normalizePixKey(chave: string, tipo?: PixConfig['tipoChave']): string {
  if (!chave) return '';
  const trimmed = chave.trim();

  // Telefone
  if (tipo === 'telefone' || (!tipo && /^\+?[0-9]{10,13}$/.test(trimmed.replace(/[^0-9+]/g, '')))) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }
    if (digits.length === 12 || digits.length === 13) {
      if (digits.startsWith('55')) return `+${digits}`;
      return `+55${digits}`;
    }
    return trimmed;
  }

  // CPF
  if (tipo === 'cpf' || (!tipo && /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(trimmed))) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 11) return digits;
  }

  // CNPJ
  if (tipo === 'cnpj' || (!tipo && /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(trimmed))) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 14) return digits;
  }

  // E-mail ou Chave Aleatória (EVP)
  return trimmed.toLowerCase();
}

/**
 * Normaliza strings para o padrão EMV (sem acentos, caracteres especiais ou cedilhas)
 */
function normalizePixText(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Calcula o Checksum CRC16 (CCITT-FALSE 0x1021) exigido pelo padrão EMV
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatEmvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Gera a string Pix Copia e Cola conforme especificação oficial do Banco Central do Brasil (BR Code EMV)
 * Compatível com 100% dos bancos brasileiros (Nubank, Itaú, Bradesco, Banco do Brasil, Inter, Caixa, Santander, etc).
 */
export function generatePixPayload(params: PixChargeParams): string {
  const chave = normalizePixKey(params.chave);
  const nome = normalizePixText(params.nomeTitular || 'SPARTAN 3D', 25) || 'SPARTAN 3D';
  const cidade = normalizePixText(params.cidade || 'MANAUS', 15) || 'MANAUS';
  // No Pix estático, txId sem webhook de API bancária deve ser '***' ou alfanumérico limpo (até 25 caracteres)
  const rawTxId = params.txId ? params.txId.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) : '';
  const txId = rawTxId || '***';
  const valorFormatado = params.valor > 0 ? params.valor.toFixed(2) : '';

  // 26: Merchant Account Information
  // Para compatibilidade universal, o campo 26 deve conter estritamente o GUI (00) e a Chave Pix (01).
  // Inserir subcampos adicionais com espaços dentro do campo 26 faz apps de bancos rejeitarem como "Chave inválida".
  const gui = formatEmvField('00', 'br.gov.bcb.pix');
  const chaveField = formatEmvField('01', chave);
  const merchantAccountInfo = formatEmvField('26', `${gui}${chaveField}`);

  // 62: Additional Data Field (TxID)
  const additionalData = formatEmvField('62', formatEmvField('05', txId));

  // Montagem do payload oficial EMV / Bacen
  const payload =
    formatEmvField('00', '01') + // Payload Format Indicator: 01
    formatEmvField('01', '11') + // Point of Initiation Method: 11 = QR Estático (reutilizável)
    merchantAccountInfo + // 26: GUI + Chave Pix
    formatEmvField('52', '0000') + // Merchant Category Code
    formatEmvField('53', '986') + // Currency: 986 (BRL - Real)
    (valorFormatado ? formatEmvField('54', valorFormatado) : '') +
    formatEmvField('58', 'BR') + // Country Code
    formatEmvField('59', nome) + // Nome do Beneficiário
    formatEmvField('60', cidade) + // Cidade
    additionalData + // 62: TxId
    '6304'; // CRC16 Header

  // Adiciona o CRC16 calculado no final
  const crc = calculateCRC16(payload);
  return `${payload}${crc}`;
}

/**
 * Gera URL de imagem do QR Code para o payload Pix
 */
export function getPixQrCodeUrl(pixPayload: string, size = 260): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    pixPayload
  )}`;
}
