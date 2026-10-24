import { describe, it, expect, beforeEach } from 'vitest';
import { getSavedTheme, saveTheme, applyThemeToDom } from './themeService';

describe('themeService', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
    };
    (globalThis as any).window = {
      dispatchEvent: () => true,
    };
    (globalThis as any).document = {
      documentElement: {
        classList: {
          classes: new Set<string>(),
          add(c: string) { this.classes.add(c); },
          remove(c: string) { this.classes.delete(c); },
          contains(c: string) { return this.classes.has(c); },
        },
      },
    };
  });

  it('retorna "default" como padrão quando nada estiver salvo', () => {
    expect(getSavedTheme()).toBe('default');
  });

  it('salva e recupera o tema "sakura"', () => {
    saveTheme('sakura', 'user-123');
    expect(getSavedTheme('user-123')).toBe('sakura');
    expect((globalThis as any).document.documentElement.classList.contains('theme-sakura')).toBe(true);
  });

  it('salva e volta para o tema "default"', () => {
    saveTheme('sakura', 'user-123');
    expect(getSavedTheme('user-123')).toBe('sakura');

    saveTheme('default', 'user-123');
    expect(getSavedTheme('user-123')).toBe('default');
    expect((globalThis as any).document.documentElement.classList.contains('theme-sakura')).toBe(false);
  });

  it('aplica tema no DOM corretamente', () => {
    applyThemeToDom('sakura');
    expect((globalThis as any).document.documentElement.classList.contains('theme-sakura')).toBe(true);

    applyThemeToDom('default');
    expect((globalThis as any).document.documentElement.classList.contains('theme-sakura')).toBe(false);
  });
});
