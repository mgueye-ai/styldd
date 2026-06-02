import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SitePublishConfig } from '../../data/sitePublish';
import { openLiveSiteUrl, resolveLiveSiteUrl } from '../../lib/openLiveSite';
import { colors } from '../../theme';

type ViewLiveSiteButtonProps = {
  sitePublish: SitePublishConfig;
  onPublish?: () => void;
  compact?: boolean;
};

export default function ViewLiveSiteButton({
  sitePublish,
  onPublish,
  compact,
}: ViewLiveSiteButtonProps) {
  const url = resolveLiveSiteUrl(sitePublish);
  const isLive = sitePublish.published && Boolean(url);

  return (
    <Pressable
      style={[styles.button, compact && styles.buttonCompact, !isLive && styles.buttonMuted]}
      onPress={() => void openLiveSiteUrl(sitePublish, onPublish)}
    >
      <Ionicons
        name={isLive ? 'globe-outline' : 'globe-outline'}
        size={compact ? 16 : 18}
        color={isLive ? colors.accentPink : colors.textMuted}
      />
      <View style={styles.textWrap}>
        <Text style={[styles.label, !isLive && styles.labelMuted]}>
          {isLive ? 'View live site' : 'View on internet'}
        </Text>
        {url && !compact ? (
          <Text style={styles.url} numberOfLines={1}>
            {url.replace(/^https?:\/\//, '')}
          </Text>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={16} color={isLive ? colors.accentPink : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  buttonCompact: {
    marginHorizontal: 0,
    marginBottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  buttonMuted: {
    opacity: 0.92,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  labelMuted: {
    color: colors.textMuted,
  },
  url: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '600',
  },
});
