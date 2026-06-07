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

// Injected after load — intercepts all clicks on links/buttons so nothing navigates away
const BLOCK_INTERACTIONS_SCRIPT = `
(function(){
  document.addEventListener('click', function(e){
    var el = e.target;
    while(el && el !== document.body){
      if(el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'FORM'){
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      el = el.parentElement;
    }
  }, true);
  document.addEventListener('submit', function(e){ e.preventDefault(); }, true);
})();
true;
`;

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
        injectedJavaScript={BLOCK_INTERACTIONS_SCRIPT}
        style={sheetStyles.webview}
        scrollEnabled
        showsVerticalScrollIndicator={!compact}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        startInLoadingState
        onShouldStartLoadWithRequest={(req) => {
          // Only allow the initial page load — block all navigations triggered by taps
          return req.navigationType === 'other' || req.url === req.mainDocumentURL;
        }}
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
