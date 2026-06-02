import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import BusinessScreenLayout from '../../components/business/BusinessScreenLayout';
import ServiceImage from '../../components/ServiceImage';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import { groupCatalogByCategory } from '../../data/serviceCatalog';
import { removeStyleCoverImage, uploadStyleCoverFromUri } from '../../lib/siteAdmin';
import { pickSiteImageFromLibrary } from '../../lib/pickSiteImage';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'StylePhotos'>;

export default function StylePhotosScreen({ navigation }: Props) {
  const { linkedSite, hasLinkedSite } = useSiteData();
  const { catalogServices, isLoading, error, refresh } = useServiceCatalog();
  const [busyId, setBusyId] = useState<string | null>(null);

  const sections = useMemo(() => groupCatalogByCategory(catalogServices), [catalogServices]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const pickPhoto = async (styleId: string) => {
    if (!linkedSite) return;

    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to upload style images.',
    );
    if (!picked) return;

    setBusyId(styleId);
    try {
      await uploadStyleCoverFromUri(linkedSite, styleId, picked.uri, picked.mimeType);
      await refresh();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload image.');
    } finally {
      setBusyId(null);
    }
  };

  const removePhoto = (styleId: string) => {
    if (!linkedSite) return;

    Alert.alert('Remove photo', 'Remove this custom thumbnail?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(styleId);
          try {
            await removeStyleCoverImage(linkedSite, styleId);
            await refresh();
          } catch (err) {
            Alert.alert('Remove failed', err instanceof Error ? err.message : 'Could not remove image.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <BusinessScreenLayout
      title="Style photos"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to upload style thumbnails to the live catalog."
      isLoading={hasLinkedSite && isLoading}
      error={hasLinkedSite && !isLoading ? error : null}
      onRefresh={refresh}
      scroll={false}
    >
      <Text style={styles.hint}>
        Upload a thumbnail per style. Images appear on your public Styles catalog.
      </Text>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.section}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <ServiceImage styleId={item.id} size={64} radius={10} />
            <View style={styles.rowContent}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.venueLabel} · {item.variant}</Text>
              <View style={styles.actions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => pickPhoto(item.id)}
                  disabled={busyId === item.id}
                >
                  <Text style={styles.actionText}>
                    {busyId === item.id ? 'Uploading…' : 'Upload'}
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtnSecondary} onPress={() => removePhoto(item.id)}>
                  <Text style={styles.actionTextSecondary}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  list: { paddingBottom: 40 },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowContent: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  actionText: { color: colors.accentPink, fontSize: 13, fontWeight: '600' },
  actionBtnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionTextSecondary: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
