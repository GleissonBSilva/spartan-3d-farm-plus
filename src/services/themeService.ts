/**
 * Serviço de Gerenciamento de Temas Visuais da Spartan 3D
 * Suporta o Tema Atual (Spartan Dark) e o Tema Rosa Flor de Sakura (Feminino / Alta Nitidez).
 */

export type ThemeMode = 'default' | 'sakura';

const THEME_STORAGE_KEY_PREFIX = 'spartan_theme_';
const GLOBAL_THEME_KEY = 'spartan_theme_global';

export function getSavedTheme(userId?: string | null): ThemeMode {
  if (typeof window === 'undefined') return 'default';
  try {
    if (userId) {
      const userTheme = localStorage.getItem(`${THEME_STORAGE_KEY_PREFIX}${userId}`);
      if (userTheme === 'sakura' || userTheme === 'default') {
        return userTheme;
      }
    }
    const globalTheme = localStorage.getItem(GLOBAL_THEME_KEY);
    if (globalTheme === 'sakura' || globalTheme === 'default') {
      return globalTheme;
    }
  } catch (e) {
    console.warn('Erro ao carregar tema:', e);
  }
  return 'default';
}

export function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'sakura') {
    root.classList.add('theme-sakura');
  } else {
    root.classList.remove('theme-sakura');
  }
}

export function saveTheme(theme: ThemeMode, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      localStorage.setItem(`${THEME_STORAGE_KEY_PREFIX}${userId}`, theme);
    }
    localStorage.setItem(GLOBAL_THEME_KEY, theme);
    applyThemeToDom(theme);
    window.dispatchEvent(new CustomEvent('spartan_theme_changed', { detail: { theme, userId } }));
  } catch (e) {
    console.warn('Erro ao salvar tema:', e);
  }
}

export function initTheme(userId?: string | null): ThemeMode {
  const current = getSavedTheme(userId);
  applyThemeToDom(current);
  return current;
}
