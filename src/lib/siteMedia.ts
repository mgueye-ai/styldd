import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { STYLE_COVER_BUCKET } from '../data/serviceCatalog';
import { supabase } from './supabase';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function normalizeMimeType(mimeType: string | null | undefined, fileUri: string): string {
  if (mimeType?.startsWith('image/')) {
    return mimeType;
  }

  const ext = fileUri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (ext && MIME_BY_EXTENSION[ext]) {
    return MIME_BY_EXTENSION[ext];
  }

  return 'image/jpeg';
}

function normalizeExtension(mimeType: string, fileUri: string): string {
  const fromMime = EXTENSION_BY_MIME[mimeType];
  if (fromMime) return fromMime;

  const fromUri = fileUri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (fromUri && fromUri.length <= 5) return fromUri;

  return 'jpg';
}

async function readImageBytes(fileUri: string): Promise<Uint8Array> {
  try {
    const file = new File(fileUri);
    if (!file.exists) {
      throw new Error('Could not read selected photo.');
    }

    const bytes = await file.bytes();
    if (!bytes.byteLength) {
      throw new Error('Selected photo is empty.');
    }

    return bytes;
  } catch (err) {
    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error('Could not read selected photo.');
      }

      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) {
        throw new Error('Selected photo is empty.');
      }

      return new Uint8Array(buffer);
    }

    throw err instanceof Error ? err : new Error('Could not read selected photo.');
  }
}

async function uploadImageAtPath(
  storagePathPrefix: string,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  const contentType = normalizeMimeType(mimeType, fileUri);
  const extension = normalizeExtension(contentType, fileUri);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const storagePath = `${storagePathPrefix}/${fileName}`;
  const bytes = await readImageBytes(fileUri);

  const { error } = await supabase.storage.from(STYLE_COVER_BUCKET).upload(storagePath, bytes, {
    upsert: true,
    contentType,
  });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function uploadUserSiteImage(
  userId: string,
  fileUri: string,
  folder: string,
  mimeType?: string | null,
): Promise<string> {
  return uploadImageAtPath(`${userId}/${folder}`, fileUri, mimeType);
}

export async function uploadStyleCoverImage(
  userId: string,
  styleId: string,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  return uploadImageAtPath(`${userId}/${styleId}`, fileUri, mimeType);
}
