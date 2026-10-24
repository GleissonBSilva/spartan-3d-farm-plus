import { describe, it, expect } from 'vitest';
import {
  generatePixPayload,
  calculateCRC16,
  getSavedPixConfig,
  getPlatformPixConfig,
  savePixConfig,
  normalizePixKey,
  DEFAULT_PIX_CONFIG,
  PixConfig,
} from './pixService';

describe('pixService', () => {
  it('calculates valid CRC16 for standard string', () => {
    // CRC16 de "123456789" no modelo CCITT 0x1021 padrão é 29B1
    const crc = calculateCRC16('123456789');
    expect(crc).toBe('29B1');
  });

  it('normalizes Pix keys according to Bacen standards', () => {
    // Telefone precisa de formato internacional E.164 (+55)
    expect(normalizePixKey('92991463640', 'telefone')).toBe('+5592991463640');
    expect(normalizePixKey('(92) 99146-3640', 'telefone')).toBe('+5592991463640');
    expect(normalizePixKey('+5592991463640', 'telefone')).toBe('+5592991463640');

    // CPF (somente dígitos)
    expect(normalizePixKey('123.456.789-00', 'cpf')).toBe('12345678900');

    // CNPJ (somente dígitos)
    expect(normalizePixKey('12.345.678/0001-99', 'cnpj')).toBe('12345678000199');

    // E-mail (minúsculo e sem espaços)
    expect(normalizePixKey('  Gleisson1984@Hotmail.com  ', 'email')).toBe('gleisson1984@hotmail.com');
  });

  it('generates valid Pix payload with mandatory EMV tags and standard Bacen format', () => {
    const payload = generatePixPayload({
      chave: '12345678000199',
      nomeTitular: 'Spartan 3D',
      cidade: 'Sao Paulo',
      valor: 150.0,
      txId: 'SPARTAN123',
    });

    expect(payload).toContain('000201'); // Payload Format Indicator
    expect(payload).toContain('010211'); // Point of Initiation Method: Static (obrigatório para apps bancários)
    expect(payload).toContain('br.gov.bcb.pix'); // GUI Pix
    expect(payload).toContain('12345678000199'); // Chave
    expect(payload).not.toContain('FATURA'); // Não deve quebrar a tag 26 com subtags com espaços
    expect(payload).toContain('5303986'); // Moeda Real
    expect(payload).toContain('5406150.00'); // Valor
    expect(payload).toContain('5802BR'); // País
    expect(payload).toContain('6304'); // Header do CRC16
    expect(payload.length).toBeGreaterThan(60);
  });

  it('returns default Pix config when user is not provided or storage is empty', () => {
    const config = getSavedPixConfig(null);
    expect(config.chave).toBe(DEFAULT_PIX_CONFIG.chave);
    expect(config.cidade).toBe(DEFAULT_PIX_CONFIG.cidade);
  });

  it('saves and retrieves user-scoped Pix config reliably', async () => {
    const testConfig: PixConfig = {
      chave: '92993746740',
      tipoChave: 'telefone',
      nomeTitular: 'GLEISSON SILVA',
      cidade: 'MANAUS',
    };

    await savePixConfig(testConfig, 'test-user-admin-123');
    const loaded = getSavedPixConfig('test-user-admin-123');

    expect(loaded.chave).toBe('92993746740');
    expect(loaded.nomeTitular).toBe('GLEISSON SILVA');
    expect(loaded.cidade).toBe('MANAUS');
  });

  it('retrieves platform Pix config with real owner defaults (never fake emails)', async () => {
    const platformConfig = await getPlatformPixConfig();
    expect(platformConfig.chave).not.toBe('spartan3d@farm.com.br');
    expect(platformConfig.chave).toBe('gleisson1984@hotmail.com');
  });
});
