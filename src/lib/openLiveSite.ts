import { Alert, Linking } from 'react-native';
import { buildPublicSiteUrl, SitePublishConfig } from '../data/sitePublish';

export function resolveLiveSiteUrl(sitePublish: SitePublishConfig): string | null {
  if (sitePublish.publicUrl?.trim()) {
    return sitePublish.publicUrl.trim();
  }
  if (sitePublish.subdomain) {
    return buildPublicSiteUrl(sitePublish.subdomain);
  }
  return null;
}

export async function openLiveSiteUrl(
  sitePublish: SitePublishConfig,
  onPublish?: () => void,
): Promise<void> {
  const url = resolveLiveSiteUrl(sitePublish);

  if (!url) {
    Alert.alert(
      'No public URL yet',
      'Publish your site to get a live link on the internet.',
      [
        { text: 'Cancel', style: 'cancel' },
        ...(onPublish ? [{ text: 'Publish', onPress: onPublish }] : []),
      ],
    );
    return;
  }

  if (!sitePublish.published) {
    Alert.alert(
      'Site not published',
      `Your site will be at ${url} once you publish.`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(onPublish ? [{ text: 'Publish', onPress: onPublish }] : []),
      ],
    );
    return;
  }

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open browser', url);
  }
}
