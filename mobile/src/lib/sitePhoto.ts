import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { SUPABASE_URL } from './config';
import { supabase } from './supabase';

// Njësoj si fotot e profilit: foto e vogël (640x400 JPEG, ~50 KB), emër i ri për çdo ngarkim dhe cache 1 vit.
// Kështu çdo telefon e shkarkon një foto vetëm një herë dhe egress-i i Supabase mbetet i vogël.
const WIDTH = 640;
const HEIGHT = 400;
const QUALITY = 0.6;
const CACHE_SECONDS = '31536000';
const BUCKET = 'site-photos';

export const sitePhotoUrl = (path: string | null | undefined) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : null;

export type PickSiteResult = { status: 'ok'; uri: string } | { status: 'cancelled' | 'denied' | 'error' };

/** Zgjedh foto nga galeria dhe e përgatit (prerje 16:10 + zvogëlim), pa e ngarkuar ende. */
export async function pickSiteImage(): Promise<PickSiteResult> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { status: 'denied' };

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [WIDTH, HEIGHT],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return { status: 'cancelled' };
    const asset = picked.assets[0];

    // Prerje në qendër (në web allowsEditing nuk punon), pastaj zvogëlim.
    const ratio = WIDTH / HEIGHT;
    const cropW = Math.min(asset.width, Math.floor(asset.height * ratio));
    const cropH = Math.floor(cropW / ratio);
    const out = await manipulateAsync(
      asset.uri,
      [
        { crop: { originX: Math.floor((asset.width - cropW) / 2), originY: Math.floor((asset.height - cropH) / 2), width: cropW, height: cropH } },
        { resize: { width: WIDTH, height: HEIGHT } },
      ],
      { compress: QUALITY, format: SaveFormat.JPEG },
    );
    return { status: 'ok', uri: out.uri };
  } catch {
    return { status: 'error' };
  }
}

/** Ngarkon foton e përgatitur dhe kthen rrugën e saj, ose null nëse dështoi. */
export async function uploadSiteImage(uri: string): Promise<string | null> {
  try {
    const body = await (await fetch(uri)).arrayBuffer();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg', cacheControl: CACHE_SECONDS });
    return up.error ? null : path;
  } catch {
    return null;
  }
}

export async function removeSiteImage(path: string | null | undefined): Promise<void> {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}
