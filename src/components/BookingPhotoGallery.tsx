import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const PHOTO_SIZE = SCREEN_W / 2 - 28;

type PhotoItem = { uri: string; label: string };

type Props = {
  photoHairPath?: string;
  photoRefPath?: string;
  /** Folder prefix in booking-photos — usually data.id from the booking payload */
  storageBookingId?: string;
};

function labelForPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  if (name.startsWith('hair')) return 'Hair photo';
  if (name.startsWith('ref')) return 'Reference';
  return 'Photo';
}

export default function BookingPhotoGallery({
  photoHairPath,
  photoRefPath,
  storageBookingId,
}: Props) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function signedUrl(path: string): Promise<string | null> {
      const { data, error } = await supabase.storage
        .from('booking-photos')
        .createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    }

    async function loadFromPaths(): Promise<PhotoItem[]> {
      const entries: { path: string; label: string }[] = [];
      if (photoHairPath?.trim()) {
        entries.push({ path: photoHairPath.trim(), label: 'Hair photo' });
      }
      if (photoRefPath?.trim()) {
        entries.push({ path: photoRefPath.trim(), label: 'Reference' });
      }

      const loaded = await Promise.all(
        entries.map(async (entry) => {
          const uri = await signedUrl(entry.path);
          return uri ? { uri, label: entry.label } : null;
        }),
      );
      return loaded.filter((item): item is PhotoItem => item !== null);
    }

    async function loadFromFolder(folderId: string): Promise<PhotoItem[]> {
      const { data: files, error } = await supabase.storage
        .from('booking-photos')
        .list(folderId);

      if (error || !files?.length) return [];

      const loaded = await Promise.all(
        files.map(async (file) => {
          const path = `${folderId}/${file.name}`;
          const uri = await signedUrl(path);
          return uri ? { uri, label: labelForPath(file.name) } : null;
        }),
      );
      return loaded.filter((item): item is PhotoItem => item !== null);
    }

    async function loadFromEdge(): Promise<PhotoItem[]> {
      if (!storageBookingId?.trim()) return [];
      const { data, error } = await supabase.functions.invoke('booking-photos-signed', {
        body: {
          bookingId: storageBookingId.trim(),
          photoHairPath: photoHairPath?.trim() || undefined,
          photoRefPath: photoRefPath?.trim() || undefined,
        },
      });
      if (error || !data?.photos?.length) return [];
      return (data.photos as PhotoItem[]).filter((p) => p?.uri);
    }

    async function load() {
      try {
        let items = await loadFromPaths();
        if (!items.length && storageBookingId?.trim()) {
          items = await loadFromFolder(storageBookingId.trim());
        }
        if (!items.length) {
          items = await loadFromEdge();
        }
        if (!cancelled) {
          setPhotos(items);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [photoHairPath, photoRefPath, storageBookingId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }

  if (!photos.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        <Text style={styles.emptyText}>No photos uploaded</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => (
        <Pressable key={`${photo.label}-${index}`} style={styles.item}>
          <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
          <View style={styles.label}>
            <Text style={styles.labelText}>{photo.label}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 24, alignItems: 'center' },
  empty: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    width: PHOTO_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.progressTrack,
  },
  image: { width: PHOTO_SIZE, height: PHOTO_SIZE },
  label: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  labelText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
