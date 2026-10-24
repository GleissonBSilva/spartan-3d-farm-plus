import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { User } from '@/types/saas';
import { supabase } from '@/lib/supabase';

export async function registerPushDevice(user: User): Promise<void> {
  if (!supabase || !user.companyId) throw new Error('A sessão ainda não está vinculada a uma empresa.');
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    throw new Error('Push nativo está disponível no app Android/iOS. Push web requer configuração VAPID.');
  }
  const permissions = await PushNotifications.checkPermissions();
  const requested = permissions.receive === 'granted' ? permissions : await PushNotifications.requestPermissions();
  if (requested.receive !== 'granted') throw new Error('Permissão de notificação não concedida.');

  await new Promise<void>((resolve, reject) => {
    void (async () => {
    let settled = false;
    let registrationListener: Awaited<ReturnType<typeof PushNotifications.addListener>> | undefined;
    let errorListener: Awaited<ReturnType<typeof PushNotifications.addListener>> | undefined;
    const cleanup = async () => { await registrationListener?.remove(); await errorListener?.remove(); };
    const timer = window.setTimeout(() => {
      if (!settled) { settled = true; void cleanup(); reject(new Error('A plataforma não retornou um token de push.')); }
    }, 15000);
    try {
      registrationListener = await PushNotifications.addListener('registration', async (token: Token) => {
        try {
          const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
          const { error } = await supabase!.from('spartan_push_subscriptions').upsert({
            company_id: user.companyId, user_id: user.id, platform, token: token.value, updated_at: new Date().toISOString(),
          }, { onConflict: 'token' });
          if (error) throw error;
          if (!settled) { settled = true; window.clearTimeout(timer); await cleanup(); resolve(); }
        } catch (error) {
          if (!settled) { settled = true; window.clearTimeout(timer); await cleanup(); reject(error); }
        }
      });
      errorListener = await PushNotifications.addListener('registrationError', event => {
        if (!settled) { settled = true; window.clearTimeout(timer); void cleanup(); reject(new Error(event.error || 'Push registration failed.')); }
      });
      await PushNotifications.register();
    } catch (error) {
      if (!settled) { settled = true; window.clearTimeout(timer); await cleanup(); reject(error); }
    }
    })();
  });
}
