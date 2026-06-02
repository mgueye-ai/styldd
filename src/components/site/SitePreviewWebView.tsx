import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SiteContent } from '../../data/siteContent';
import {
  buildSitePreviewHtml,
  buildSitePreviewInjection,
  DEFAULT_PREVIEW_THEME,
  getSitePreviewPageUrl,
  SitePreviewStyle,
  SitePreviewTheme,
} from '../../lib/sitePreviewHtml';

type SitePreviewWebViewProps = {
  content: SiteContent;
  styles?: SitePreviewStyle[];
  theme?: SitePreviewTheme;
  compact?: boolean;
};

const APPLY_PREVIEW_SCRIPT =
  'if(window.applyStyldPreviewContent){window.applyStyldPreviewContent();}true;';

export default function SitePreviewWebView({
  content,
  styles: previewStyles = [],
  theme = DEFAULT_PREVIEW_THEME,
  compact,
}: SitePreviewWebViewProps) {
  const webRef = useRef<WebView>(null);
  const hostedUrl = getSitePreviewPageUrl();
  const html = useMemo(
    () => buildSitePreviewHtml(content, previewStyles, theme),
    [content, previewStyles, theme],
  );
  const injection = useMemo(
    () => `${buildSitePreviewInjection(content, previewStyles, theme)}${APPLY_PREVIEW_SCRIPT}`,
    [content, previewStyles, theme],
  );

  useEffect(() => {
    if (!hostedUrl) return;
    webRef.current?.injectJavaScript(injection);
  }, [hostedUrl, injection]);

  return (
    <View style={[sheetStyles.wrap, compact && sheetStyles.wrapCompact]}>
      <WebView
        ref={webRef}
        source={hostedUrl ? { uri: hostedUrl } : { html }}
        injectedJavaScriptBeforeContentLoaded={hostedUrl ? injection : undefined}
        style={sheetStyles.webview}
        scrollEnabled
        showsVerticalScrollIndicator={!compact}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={sheetStyles.loading}>
            <ActivityIndicator color="#db2777" />
          </View>
        )}
      />
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  wrapCompact: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
});
