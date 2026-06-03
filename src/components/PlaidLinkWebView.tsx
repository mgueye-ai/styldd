import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../theme';

type PlaidSuccessPayload = {
  publicToken: string;
  accountId: string;
  institutionName?: string;
  accountMask?: string;
};

type Props = {
  visible: boolean;
  linkToken: string;
  onClose: () => void;
  onSuccess: (payload: PlaidSuccessPayload) => void;
  onError: (message: string) => void;
};

function buildPlaidHtml(linkToken: string, receivedRedirectUri?: string): string {
  const safe = JSON.stringify(linkToken);
  const safeRedirect = JSON.stringify(receivedRedirectUri ?? null);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;
         align-items:center;justify-content:center;min-height:100vh;margin:0;
         background:#fff;color:#333;padding:24px;box-sizing:border-box;}
    #status{font-size:15px;text-align:center;margin-top:12px;}
    #err{color:#e11d48;font-size:13px;margin-top:8px;text-align:center;}
  </style>
</head>
<body>
  <div id="status">Loading secure bank connection…</div>
  <div id="err"></div>
  <script>
    var TOKEN = ${safe};
    var RECEIVED_REDIRECT_URI = ${safeRedirect};

    function post(obj){
      try{
        if(window.ReactNativeWebView){
          window.ReactNativeWebView.postMessage(JSON.stringify(obj));
        }
      }catch(e){}
    }

    window.onerror=function(msg){
      document.getElementById('err').textContent='Error: '+msg;
      post({type:'error',message:'Plaid failed to load: '+msg});
      return true;
    };

    function initPlaid(){
      try{
        var config = {
          token: TOKEN,
          onSuccess:function(public_token,metadata){
            var acct=metadata&&metadata.accounts&&metadata.accounts[0];
            if(!acct||!acct.id){post({type:'error',message:'No account selected'});return;}
            post({
              type:'success',
              publicToken:public_token,
              accountId:acct.id,
              institutionName:metadata.institution&&metadata.institution.name||'',
              accountMask:acct.mask||''
            });
          },
          onExit:function(err){
            if(err&&err.error_message)post({type:'error',message:err.error_message});
            else post({type:'exit'});
          },
          onEvent:function(){}
        };
        // Re-entering after OAuth redirect
        if(RECEIVED_REDIRECT_URI){
          config.receivedRedirectUri = RECEIVED_REDIRECT_URI;
        }
        var handler=Plaid.create(config);
        handler.open();
        document.getElementById('status').textContent='Follow the steps in the bank connection…';
      }catch(e){
        document.getElementById('err').textContent='Could not start: '+e.message;
        post({type:'error',message:e.message});
      }
    }

    var script=document.createElement('script');
    script.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload=function(){initPlaid();};
    script.onerror=function(){
      document.getElementById('err').textContent='Could not load Plaid. Check internet connection.';
      post({type:'error',message:'Could not load Plaid script. Check network and try again.'});
    };
    document.head.appendChild(script);
  </script>
</body>
</html>`;
}

export default function PlaidLinkWebView({ visible, linkToken, onClose, onSuccess, onError }: Props) {
  const [webviewKey, setWebviewKey] = useState(0);
  const [oauthRedirectUri, setOAuthRedirectUri] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setWebviewKey((k) => k + 1);
      setOAuthRedirectUri(undefined);
      timerRef.current = setTimeout(() => {
        onError('Bank link timed out. Please try again.');
        onClose();
      }, 30_000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onClose, onError]);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleMessage(event: WebViewMessageEvent) {
    clearTimer();
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        message?: string;
        publicToken?: string;
        accountId?: string;
        institutionName?: string;
        accountMask?: string;
      };
      if (payload.type === 'success' && payload.publicToken && payload.accountId) {
        onSuccess({
          publicToken: payload.publicToken,
          accountId: payload.accountId,
          institutionName: payload.institutionName,
          accountMask: payload.accountMask,
        });
        onClose();
      } else if (payload.type === 'error') {
        onError(payload.message || 'Bank link failed');
        onClose();
      } else if (payload.type === 'exit') {
        onClose();
      }
    } catch {
      onError('Could not read bank response');
      onClose();
    }
  }

  if (!visible || !linkToken) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Connect bank account</Text>
        <View style={styles.headerSpacer} />
      </View>
      <WebView
        key={webviewKey}
        source={{
          html: buildPlaidHtml(linkToken, oauthRedirectUri),
          baseUrl: 'https://cdn.plaid.com',
        }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        onNavigationStateChange={(navState) => {
          // Detect when Plaid redirects the WebView for OAuth authentication.
          // The URL will contain oauth_state_id after the bank authenticates.
          if (navState.url && navState.url.includes('oauth_state_id')) {
            clearTimer();
            // Rebuild the page with receivedRedirectUri so Plaid can complete
            setOAuthRedirectUri(navState.url);
            setWebviewKey((k) => k + 1);
          }
        }}
        onMessage={handleMessage}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.accentPink} />
            <Text style={styles.loadingText}>Starting secure bank connection…</Text>
          </View>
        )}
        startInLoadingState
        style={styles.webview}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  close: { color: colors.accentPink, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  headerSpacer: { width: 60 },
  webview: { flex: 1, backgroundColor: '#fff' },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 12,
  } as object,
  loadingText: { fontSize: 14, color: colors.textMuted },
});
