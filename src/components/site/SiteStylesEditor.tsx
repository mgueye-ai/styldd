import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ServiceImage from '../ServiceImage';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { CatalogService } from '../../data/serviceCatalog';
import { formatStylePrice } from '../../data/siteStyles';
import { pickSiteImageFromLibrary } from '../../lib/pickSiteImage';
import { colors } from '../../theme';

type StyleEditorCardProps = {
  service: CatalogService;
  busy: boolean;
  onBusyChange: (styleId: string | null) => void;
};

function StyleEditorCard({ service, busy, onBusyChange }: StyleEditorCardProps) {
  const {
    getStyleMeta,
    getPrice,
    upsertStyle,
    deleteStyle,
    uploadStyleImage,
  } = useServiceCatalog();

  const meta = getStyleMeta(service.id);
  const [title, setTitle] = useState(meta?.title ?? service.name);
  const [description, setDescription] = useState(meta?.description ?? service.description ?? '');
  const [price, setPrice] = useState(String(getPrice(service.id) || ''));
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);
  const lastSavedSnapshot = useRef('');

  const snapshot = `${title}|${description}|${price}`;

  useEffect(() => {
    setTitle(meta?.title ?? service.name);
    setDescription(meta?.description ?? service.description ?? '');
    setPrice(String(getPrice(service.id) || ''));
    setLocalImageUri(null);
    skipNextSave.current = true;
    lastSavedSnapshot.current = `${meta?.title ?? service.name}|${meta?.description ?? service.description ?? ''}|${getPrice(service.id) || ''}`;
  }, [service.id]);

  const saveStyle = useCallback(async () => {
    const parsedPrice = Number(price.replace(/[^0-9.]/g, ''));
    onBusyChange(service.id);
    try {
      await upsertStyle({
        id: service.id,
        title,
        description,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        category: meta?.category ?? service.category,
        venue: service.venue,
      });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not save style.');
    } finally {
      onBusyChange(null);
    }
  }, [description, meta?.category, onBusyChange, price, service.category, service.id, service.venue, title, upsertStyle]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (snapshot === lastSavedSnapshot.current) {
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveStyle().then(() => {
        lastSavedSnapshot.current = snapshot;
      });
    }, 900);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [snapshot, saveStyle]);

  const pickImage = async () => {
    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to upload style images.',
    );
    if (!picked) return;

    setLocalImageUri(picked.uri);
    onBusyChange(service.id);

    try {
      await uploadStyleImage(service.id, picked.uri, picked.mimeType);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload image.');
      setLocalImageUri(null);
    } finally {
      onBusyChange(null);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete style', `Remove "${title}" from your menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          onBusyChange(service.id);
          try {
            await deleteStyle(service.id);
          } catch (err) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Could not delete style.');
          } finally {
            onBusyChange(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Pressable style={styles.imageButton} onPress={pickImage} disabled={busy}>
          {localImageUri ? (
            <Image source={{ uri: localImageUri }} style={styles.thumbnail} />
          ) : (
            <ServiceImage styleId={service.id} size={72} radius={14} />
          )}
          <View style={styles.imageOverlay}>
            <Ionicons name="camera-outline" size={16} color="#fff" />
          </View>
        </Pressable>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardMeta}>{service.venueLabel}</Text>
          {busy ? <ActivityIndicator size="small" color={colors.accentPink} /> : null}
        </View>
        <Pressable onPress={confirmDelete} hitSlop={8} disabled={busy}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Knotless braids" />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Tell clients what is included"
        multiline
      />
      <Field
        label="Price"
        value={price}
        onChangeText={setPrice}
        placeholder="150"
        keyboardType="decimal-pad"
      />
      <Text style={styles.priceHint}>
        {formatStylePrice(Number(price.replace(/[^0-9.]/g, '')) || 0)}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default function SiteStylesEditor() {
  const { catalogServices, isLoading, error, upsertStyle, isSaving } = useServiceCatalog();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newImageMimeType, setNewImageMimeType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const pickNewImage = async () => {
    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to upload style images.',
    );
    if (!picked) return;
    setNewImageUri(picked.uri);
    setNewImageMimeType(picked.mimeType ?? null);
  };

  const addStyle = async () => {
    const parsedPrice = Number(newPrice.replace(/[^0-9.]/g, ''));
    if (!newTitle.trim()) {
      Alert.alert('Title required', 'Give your style a name before adding it.');
      return;
    }

    setIsAdding(true);
    try {
      await upsertStyle(
        {
          title: newTitle,
          description: newDescription,
          price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        },
        newImageUri,
        newImageMimeType,
      );
      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setNewImageUri(null);
      setNewImageMimeType(null);
    } catch (err) {
      Alert.alert('Add failed', err instanceof Error ? err.message : 'Could not add style.');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accentPink} />
        <Text style={styles.helper}>Loading your styles…</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View>
      <Text style={styles.helper}>
        Add styles with photos, titles, descriptions, and prices. Changes save automatically and
        appear in your site preview.
      </Text>

      <Text style={styles.groupTitle}>Add a style</Text>
      <View style={styles.card}>
        <Pressable style={styles.newImageButton} onPress={pickNewImage} disabled={isAdding}>
          {newImageUri ? (
            <Image source={{ uri: newImageUri }} style={styles.newThumbnail} />
          ) : (
            <View style={styles.newImagePlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.textMuted} />
              <Text style={styles.newImageText}>Add photo</Text>
            </View>
          )}
        </Pressable>
        <Field label="Title" value={newTitle} onChangeText={setNewTitle} placeholder="Silk press" />
        <Field
          label="Description"
          value={newDescription}
          onChangeText={setNewDescription}
          placeholder="What clients should know"
          multiline
        />
        <Field
          label="Price"
          value={newPrice}
          onChangeText={setNewPrice}
          placeholder="120"
          keyboardType="decimal-pad"
        />
        <Pressable
          style={[styles.addButton, (isAdding || isSaving) && styles.addButtonDisabled]}
          onPress={addStyle}
          disabled={isAdding || isSaving}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>{isAdding ? 'Adding…' : 'Add style'}</Text>
        </Pressable>
      </View>

      <Text style={styles.groupTitle}>Your menu ({catalogServices.length})</Text>
      {catalogServices.length === 0 ? (
        <Text style={styles.empty}>No styles yet. Add your first one above.</Text>
      ) : (
        catalogServices.map((service) => (
          <StyleEditorCard
            key={service.id}
            service={service}
            busy={busyId === service.id}
            onBusyChange={setBusyId}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  error: {
    color: '#f87171',
    fontSize: 14,
    lineHeight: 20,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  imageButton: {
    position: 'relative',
  },
  imageOverlay: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 14,
  },
  field: {
    marginBottom: 10,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  priceHint: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  newImageButton: {
    marginBottom: 12,
  },
  newThumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 14,
  },
  newImagePlaceholder: {
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.background,
  },
  newImageText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
