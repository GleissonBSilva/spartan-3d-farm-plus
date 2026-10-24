import { describe, expect, it } from 'vitest';
import {
  formatPhoneMask,
  formatWelcomeWhatsAppMessage,
  normalizeWhatsAppPhone,
  sendWelcomeWhatsApp,
  SPARTAN_OFFICIAL_WHATSAPP_NUMBER,
} from './whatsappService';

describe('whatsappService', () => {
  it('normalizes 11-digit Brazilian phone numbers by prefixing 55', () => {
    expect(normalizeWhatsAppPhone('92993746740')).toBe('5592993746740');
    expect(normalizeWhatsAppPhone('(92) 99374-6740')).toBe('5592993746740');
    expect(normalizeWhatsAppPhone('092993746740')).toBe('5592993746740');
  });

  it('normalizes 10-digit Brazilian phone numbers by prefixing 55', () => {
    expect(normalizeWhatsAppPhone('9232345678')).toBe('559232345678');
    expect(normalizeWhatsAppPhone('(92) 3234-5678')).toBe('559232345678');
  });

  it('preserves existing country code if already starting with 55 and full length', () => {
    expect(normalizeWhatsAppPhone('5592993746740')).toBe('5592993746740');
    expect(normalizeWhatsAppPhone('+55 (92) 99374-6740')).toBe('5592993746740');
  });

  it('applies Brazilian phone visual masking correctly', () => {
    expect(formatPhoneMask('92')).toBe('(92');
    expect(formatPhoneMask('9299374')).toBe('(92) 9937-4');
    expect(formatPhoneMask('92993746740')).toBe('(92) 99374-6740');
  });

  it('formats the official welcome message including the farm name and official number', () => {
    const message = formatWelcomeWhatsAppMessage('Oficina 3D Criativa');
    expect(message).toContain('Olá, Amigo (a)!');
    expect(message).toContain('Sua conta para a farm Oficina 3D Criativa já está ativa.');
    expect(message).toContain('(92) 99374-6740');
    expect(message).toContain('https://spartan-3dprint.vercel.app/login');
  });

  it('uses fallback farm name if company name is empty', () => {
    const message = formatWelcomeWhatsAppMessage('');
    expect(message).toContain('Sua conta para a farm sua Farm 3D já está ativa.');
  });

  it('simulates welcome message dispatch and produces valid previewUrl', async () => {
    const result = await sendWelcomeWhatsApp({
      phone: '(92) 99374-6740',
      companyName: 'Spartan Lab 3D',
      name: 'Gleison',
    });

    expect(result.success).toBe(true);
    expect(result.targetPhone).toBe('5592993746740');
    expect(result.previewUrl).toContain('https://api.whatsapp.com/send?phone=5592993746740');
  });

  it('fails gracefully when phone is invalid or too short', async () => {
    const result = await sendWelcomeWhatsApp({
      phone: '123',
      companyName: 'Invalida',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Telefone inválido');
  });
});
