import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { ExpoStatusBar } from 'expo-status-bar';

interface Message {
  step_index: number;
  source: string;
  type: string;
  content?: string;
  created_at?: string;
  tool_calls?: any[];
}

export default function App() {
  const [ipAddress, setIpAddress] = useState(
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : '192.168.1.100'
  );
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('Gemini 3.5 Flash (High)');
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const models = [
    'Gemini 3.5 Flash (High)',
    'Gemini 3.5 Flash (Medium)',
    'Gemini 3.5 Flash (Low)',
    'Claude 3.5 Sonnet',
    'GPT-4o'
  ];

  const connectToBridge = () => {
    if (!ipAddress.trim()) {
      setErrorMsg('Please enter a valid IP address');
      return;
    }
    setConnecting(true);
    setErrorMsg('');

    // Normalize address format
    const wsUrl = ipAddress.includes(':') 
      ? `ws://${ipAddress}` 
      : `ws://${ipAddress}:8080`;

    console.log(`Connecting to ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setErrorMsg('');
        console.log('Connected to PC bridge!');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setMessages(data.messages);
        } else if (data.type === 'update') {
          setMessages((prev) => {
            // Avoid duplicates
            const exists = prev.some((m) => m.step_index === data.message.step_index && m.type === data.message.type && m.content === data.message.content);
            if (exists) return prev;
            return [...prev, data.message];
          });
        }
      };

      ws.onerror = (e) => {
        setErrorMsg('Connection failed. Make sure PC bridge is running.');
        setConnecting(false);
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
      };
    } catch (err: any) {
      setErrorMsg(`Error: ${err.message}`);
      setConnecting(false);
      setConnected(false);
    }
  };

  const disconnectBridge = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnected(false);
    setMessages([]);
  };

  // Real-time input synchronization
  const handleTextChange = (text: string) => {
    setInputText(text);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'input',
          text
        })
      );
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'send'
        })
      );
      setInputText('');
    }
  };

  const triggerNewChat = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'new_chat'
        })
      );
    }
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setShowModelDropdown(false);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'change_model',
          model
        })
      );
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  if (!connected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.setupContainer}>
          <Text style={styles.titleText}>ANTIGRAVITY REMOTE</Text>
          <Text style={styles.subtitleText}>Control your workspace from your phone</Text>

          <View style={styles.card}>
            <Text style={styles.label}>PC Bridge IP Address</Text>
            <TextInput
              style={styles.input}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholder="e.g. 192.168.1.100"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={styles.connectButton}
              onPress={connectToBridge}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>CONNECT TO PC</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Antigravity Chat</Text>
            <Text style={styles.statusText}>● Connected to PC</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.newChatBtn} onPress={triggerNewChat}>
              <Text style={styles.newChatBtnText}>+ New Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectBridge}>
              <Text style={styles.disconnectBtnText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Model Selector Bar */}
        <View style={styles.modelBar}>
          <TouchableOpacity
            style={styles.modelSelector}
            onPress={() => setShowModelDropdown(!showModelDropdown)}
          >
            <Text style={styles.modelSelectorText}>Model: {selectedModel}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>

          {showModelDropdown && (
            <View style={styles.dropdownMenu}>
              {models.map((model) => (
                <TouchableOpacity
                  key={model}
                  style={styles.dropdownItem}
                  onPress={() => handleModelSelect(model)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedModel === model && styles.dropdownItemTextSelected
                    ]}
                  >
                    {model}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Messages Feed */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyText}>No messages yet. Start typing below to begin.</Text>
            </View>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.source === 'USER_EXPLICIT' || msg.source === 'USER';
              const isModel = msg.source === 'MODEL';
              
              if (isUser) {
                // Remove <USER_REQUEST> markers if present for clean display
                let content = msg.content || '';
                content = content.replace(/<USER_REQUEST>|<\/USER_REQUEST>/gi, '').trim();
                
                return (
                  <View key={index} style={styles.userMessageContainer}>
                    <View style={styles.userBubble}>
                      <Text style={styles.messageText}>{content}</Text>
                    </View>
                  </View>
                );
              } else if (isModel) {
                return (
                  <View key={index} style={styles.modelMessageContainer}>
                    <View style={styles.modelHeaderRow}>
                      <Text style={styles.modelNameText}>AI Assistant</Text>
                    </View>
                    <View style={styles.modelBubble}>
                      <Text style={styles.messageText}>{msg.content}</Text>
                    </View>
                  </View>
                );
              } else {
                // Render Tool Executions or Logs in a terminal-like bubble
                const label = msg.type || msg.source;
                let logDetails = msg.content || '';
                
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                  logDetails = msg.tool_calls.map(tc => `${tc.name}(${JSON.stringify(tc.args)})`).join('\n');
                }

                return (
                  <View key={index} style={styles.logContainer}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logHeaderText}>⚙️ Tool: {label}</Text>
                    </View>
                    {logDetails ? (
                      <View style={styles.logBody}>
                        <Text style={styles.logBodyText} numberOfLines={10}>{logDetails}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              }
            })
          )}
        </ScrollView>

        {/* Bottom Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.chatInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Type a prompt..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117'
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center'
  },
  titleText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#58a6ff',
    letterSpacing: 2,
    marginBottom: 8
  },
  subtitleText: {
    fontSize: 14,
    color: '#8b949e',
    marginBottom: 40,
    textAlign: 'center'
  },
  card: {
    width: '100%',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  label: {
    color: '#c9d1d9',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    color: '#c9d1d9',
    padding: 12,
    fontSize: 16,
    marginBottom: 16
  },
  errorText: {
    color: '#ff7b72',
    fontSize: 14,
    marginBottom: 16
  },
  connectButton: {
    backgroundColor: '#238636',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center'
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  header: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#161b22'
  },
  headerTitle: {
    color: '#f0f6fc',
    fontSize: 16,
    fontWeight: 'bold'
  },
  statusText: {
    color: '#56d364',
    fontSize: 11,
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  newChatBtn: {
    backgroundColor: '#1f6feb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8
  },
  newChatBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  disconnectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#f85149',
    borderRadius: 6
  },
  disconnectBtnText: {
    color: '#f85149',
    fontSize: 12
  },
  modelBar: {
    zIndex: 10,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  modelSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  modelSelectorText: {
    color: '#c9d1d9',
    fontSize: 13
  },
  dropdownArrow: {
    color: '#8b949e',
    fontSize: 10
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363d'
  },
  dropdownItemText: {
    color: '#c9d1d9',
    fontSize: 13
  },
  dropdownItemTextSelected: {
    color: '#58a6ff',
    fontWeight: 'bold'
  },
  feed: {
    flex: 1
  },
  feedContent: {
    padding: 16,
    paddingBottom: 24
  },
  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100
  },
  emptyText: {
    color: '#8b949e',
    fontSize: 14,
    textAlign: 'center'
  },
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16
  },
  userBubble: {
    backgroundColor: '#1f6feb',
    borderRadius: 16,
    borderBottomRightRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%'
  },
  modelMessageContainer: {
    marginBottom: 18
  },
  modelHeaderRow: {
    marginBottom: 4
  },
  modelNameText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600'
  },
  modelBubble: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 16,
    borderBottomLeftRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%'
  },
  messageText: {
    color: '#f0f6fc',
    fontSize: 15,
    lineHeight: 20
  },
  logContainer: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 8,
    marginBottom: 14,
    overflow: 'hidden'
  },
  logHeader: {
    backgroundColor: '#161b22',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d'
  },
  logHeaderText: {
    color: '#8b949e',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'
  },
  logBody: {
    padding: 10,
    backgroundColor: '#05070a'
  },
  logBodyText: {
    color: '#ff7b72',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    lineHeight: 15
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#161b22',
    borderTopWidth: 1,
    borderTopColor: '#30363d',
    alignItems: 'flex-end'
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 20,
    color: '#c9d1d9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 8,
    fontSize: 15,
    maxHeight: 120
  },
  sendButton: {
    backgroundColor: '#238636',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 2
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2
  }
});
