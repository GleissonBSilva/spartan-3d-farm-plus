import { supabase } from '@/lib/supabase';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['stl', '3mf', 'gcode', 'gco', 'g', 'jpg', 'jpeg', 'png', 'webp']);

export async function uploadModelFile(file: File, companyId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('Use STL, 3MF, G-code ou imagem JPG, PNG e WebP.');
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error('O arquivo deve ter até 50 MB.');
  const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100);
  const path = `${companyId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('3d-models').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createModelSignedUrl(path: string, expiresInSeconds = 300) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage.from('3d-models').createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
