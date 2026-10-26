import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { SUPABASE_URL } from './config';
import { supabase } from './supabase';

// Plani falas i Supabase ka kufi egress: foto e vogël, emër i ri për çdo ngarkim dhe cache 1 vit.
const SIZE = 256;
const QUALITY = 0.7;
const CACHE_SECONDS = '31536000';

export const avatarUrl = (path: string | null | undefined) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}` : null;

export type PickResult = 'ok' | 'cancelled' | 'denied' | 'error';

export async function pickAndUploadAvatar(employeeId: string, oldPath: string | null): Promise<PickResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'denied';

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return 'cancelled';
    const asset = picked.assets[0];

    // Prerje katrore në qendër (në web allowsEditing nuk punon), pastaj zvogëlim në 256 px.
    const side = Math.min(asset.width, asset.height);
    const out = await manipulateAsync(
      asset.uri,
      [
        { crop: { originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side } },
        { resize: { width: SIZE, height: SIZE } },
      ],
      { compress: QUALITY, format: SaveFormat.JPEG },
    );

    const body = await (await fetch(out.uri)).arrayBuffer();
    const path = `${employeeId}/${Date.now()}.jpg`;
    const up = await supabase.storage
      .from('avatars')
      .upload(path, body, { contentType: 'image/jpeg', cacheControl: CACHE_SECONDS });
    if (up.error) return 'error';

    const rpc = await supabase.rpc('set_avatar', { p_path: path });
    if (rpc.error) {
      await supabase.storage.from('avatars').remove([path]);
      return 'error';
    }
    // Fshij foton e vjetër që storage të mos mbushet.
    if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function removeAvatar(oldPath: string | null): Promise<boolean> {
  const rpc = await supabase.rpc('set_avatar', { p_path: null });
  if (rpc.error) return false;
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
  return true;
}
