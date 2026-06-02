import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { pickSiteImageFromLibrary } from '../../lib/pickSiteImage';
import { colors } from '../../theme';

type HeroImagePickerProps = {
  imageUrl?: string | null;
  localUri?: string | null;
  busy?: boolean;
  placeholder?: string;
  onPick: (uri: string) => Promise<void>;
  onRemove?: () => void;
  large?: boolean;
};

export default function HeroImagePicker({
  imageUrl,
  localUri,
  busy,
  placeholder = 'Choose photo',
  onPick,
  onRemove,
  large,
}: HeroImagePickerProps) {
  const [picking, setPicking] = useState(false);
  const displayUri = localUri ?? imageUrl;

  const pickImage = async () => {
    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to upload your hero image.',
    );
    if (!picked) return;

    setPicking(true);
    try {
      await onPick(picked.uri);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload image.');
    } finally {
      setPicking(false);
    }
  };

  const isBusy = busy || picking;

  return (
    <View>
      <Pressable
        style={[styles.button, large && styles.buttonLarge]}
        onPress={pickImage}
        disabled={isBusy}
      >
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={[styles.image, large && styles.imageLarge]} />
        ) : (
          <View style={[styles.placeholder, large && styles.placeholderLarge]}>
            <Ionicons name="image-outline" size={large ? 32 : 24} color={colors.textMuted} />
            <Text style={styles.placeholderText}>{placeholder}</Text>
          </View>
        )}
        <View style={styles.overlay}>
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.overlayText}>{displayUri ? 'Change photo' : 'Add photo'}</Text>
            </>
          )}
        </View>
      </Pressable>
      {displayUri && onRemove ? (
        <Pressable style={styles.removeBtn} onPress={onRemove} disabled={isBusy}>
          <Text style={styles.removeText}>Remove photo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  buttonLarge: {
    borderRadius: 18,
  },
  image: {
    width: '100%',
    height: 140,
  },
  imageLarge: {
    height: 200,
  },
  placeholder: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.background,
  },
  placeholderLarge: {
    height: 200,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  removeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
