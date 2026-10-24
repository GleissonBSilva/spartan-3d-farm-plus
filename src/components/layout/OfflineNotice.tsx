import React, { useEffect, useState } from 'react';

export const OfflineNotice: React.FC = () => {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); };
  }, []);
  if (online) return null;
  return <div role="status" className="sticky top-0 z-[100] bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-950">Sem conexão. A interface pode abrir, mas os dados do Supabase só sincronizam quando a rede voltar.</div>;
};
