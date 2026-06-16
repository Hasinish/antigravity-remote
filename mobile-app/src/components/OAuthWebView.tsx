import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { WebView } from 'react-native-webview';

interface OAuthWebViewProps {
  url: string;
  onCallback: (code: string, state: string, port: number) => void;
  onClose: () => void;
}

export const OAuthWebView: React.FC<OAuthWebViewProps> = ({ url, onCallback, onClose }) => {
  const handledRef = useRef(false);

  if (Platform.OS === 'web') {
    // On web, we can't use react-native-webview — open in a new tab instead
    // and tell the user to come back after signing in
    React.useEffect(() => {
      window.open(url, '_blank');
    }, []);

    return (
      <Modal transparent animationType="fade" visible>
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <Text style={styles.title}>Sign in with Google</Text>
            <Text style={styles.body}>
              A new browser tab opened with the Google sign-in page.{'\n\n'}
              Complete sign-in there — this app will update automatically.
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const handleNavigationChange = (navState: { url: string }) => {
    const navUrl = navState.url || '';
    // Intercept the OAuth callback redirect before it fires
    if (!handledRef.current && navUrl.includes('/oauth-callback')) {
      handledRef.current = true;
      try {
        const parsed = new URL(navUrl);
        const code = parsed.searchParams.get('code') || '';
        const state = parsed.searchParams.get('state') || '';
        const port = parseInt(parsed.port, 10) || 80;
        if (code) {
          onCallback(code, state, port);
          return;
        }
      } catch (e) {}
      // Fallback: pass the raw URL
      onCallback('', '', 0);
    }
  };

  return (
    <Modal animationType="slide" visible>
      <View style={styles.container}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>Sign in with Google</Text>
          <TouchableOpacity onPress={onClose} style={styles.barClose}>
            <Text style={styles.barCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: url }}
          onNavigationStateChange={handleNavigationChange}
          onShouldStartLoadWithRequest={(req) => {
            // Intercept the callback redirect — don't actually navigate to localhost
            if (!handledRef.current && req.url.includes('/oauth-callback')) {
              handledRef.current = true;
              try {
                const parsed = new URL(req.url);
                const code = parsed.searchParams.get('code') || '';
                const state = parsed.searchParams.get('state') || '';
                const port = parseInt(parsed.port, 10) || 80;
                if (code) {
                  onCallback(code, state, port);
                  return false; // block the navigation
                }
              } catch (e) {}
            }
            return true;
          }}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  bar: {
    height: 52,
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  barTitle: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '600',
  },
  barClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCloseText: {
    color: '#a1a1aa',
    fontSize: 16,
  },
  // Web fallback styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: 320,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 24,
  },
  title: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  closeBtn: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '600',
  },
});
