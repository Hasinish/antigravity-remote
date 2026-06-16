import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Linking
} from 'react-native';

import { SetupScreen } from './src/components/SetupScreen';
import { Header } from './src/components/Header';
import { HistoryPanel } from './src/components/HistoryPanel';
import { MessageFeed } from './src/components/MessageFeed';
import { ChatInput, ChatInputHandle } from './src/components/ChatInput';
import { OAuthWebView } from './src/components/OAuthWebView';
import { QuotaPanel } from './src/components/QuotaPanel';

import { styles } from './src/styles';
import { Message, Conversation } from './src/types';

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
  const [selectedModel, setSelectedModel] = useState('Gemini 3.5 Flash (High)');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [switchingConversation, setSwitchingConversation] = useState(false);
  const [switchOptions, setSwitchOptions] = useState<{ label: string; description: string }[] | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [switchedToTitle, setSwitchedToTitle] = useState<string | null>(null);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [showQuota, setShowQuota] = useState(false);
  const [quotaModels, setQuotaModels] = useState<any[] | null>(null);
  const [quotaTier, setQuotaTier] = useState<string | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<any>(null);
  const switchedToastTimer = useRef<any>(null);
  // Ref to the ChatInput component so we can push IDE text in without re-rendering App
  const chatInputRef = useRef<ChatInputHandle>(null);

  const [models, setModels] = useState<string[]>([
    'Gemini 3.5 Flash (High)',
    'Gemini 3.5 Flash (Medium)',
    'Gemini 3.5 Flash (Low)',
    'Claude 3.5 Sonnet',
    'GPT-4o'
  ]);

  const toggleModelDropdown = useCallback((show: boolean) => {
    setShowModelDropdown(show);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: show ? 'open_model_dropdown' : 'close_model_dropdown'
        })
      );
    }
  }, []);

  const connectToBridge = () => {
    if (!ipAddress.trim()) {
      setErrorMsg('Please enter a valid IP address');
      return;
    }
    setConnecting(true);
    setErrorMsg('');

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
          setSwitchingConversation(false);
          setSwitchOptions(null);
          setPendingSwitchId(null);
        } else if (data.type === 'update') {
          setMessages((prev) => {
            const exists = prev.some((m) => m.step_index === data.message.step_index && m.type === data.message.type && m.content === data.message.content);
            if (exists) return prev;
            return [...prev, data.message];
          });
        } else if (data.type === 'clear') {
          setMessages([]);
        } else if (data.type === 'conversation_list') {
          setConversations(data.conversations);
          setShowHistoryDropdown(true);
        } else if (data.type === 'hide_history_panel') {
          setShowHistoryDropdown(false);
        } else if (data.type === 'switch_options') {
          setSwitchOptions(data.options);
          setPendingSwitchId(data.id);
          setSwitchingConversation(false);
        } else if (data.type === 'hide_switch_options') {
          setSwitchOptions(null);
          setPendingSwitchId(null);
          setSwitchingConversation(false);
        } else if (data.type === 'error') {
          setSwitchingConversation(false);
          setSwitchOptions(null);
          setPendingSwitchId(null);
        } else if (data.type === 'ide_input') {
          // Push IDE text directly into ChatInput without re-rendering App
          chatInputRef.current?.setTextExternal(data.text);
        } else if (data.type === 'conversation_switched') {
          setSwitchedToTitle(data.title);
          if (switchedToastTimer.current) clearTimeout(switchedToastTimer.current);
          switchedToastTimer.current = setTimeout(() => setSwitchedToTitle(null), 3000);
        } else if (data.type === 'quota_data') {
          setQuotaModels(data.models || []);
          setQuotaTier(data.userTier || null);
          setQuotaLoading(false);
        } else if (data.type === 'user_info') {
          setLoggedInUser(data.name || null);
        } else if (data.type === 'oauth_url') {
          setOauthUrl(data.url);
        } else if (data.type === 'login_complete') {
          setOauthUrl(null);
          if (data.success) {
            setSwitchedToTitle('Logged in successfully');
            if (switchedToastTimer.current) clearTimeout(switchedToastTimer.current);
            switchedToastTimer.current = setTimeout(() => setSwitchedToTitle(null), 3000);
          }
        } else if (data.type === 'model_changed') {
          setSelectedModel(data.model);
        } else if (data.type === 'show_model_dropdown') {
          setModels(data.models);
          setShowModelDropdown(true);
        } else if (data.type === 'hide_model_dropdown') {
          setShowModelDropdown(false);
        }
      };

      ws.onerror = () => {
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

  const disconnectBridge = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnected(false);
    setMessages([]);
  }, []);

  // Called by ChatInput (debounced) to sync current text to IDE
  const handleTextChange = useCallback((text: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'input', text }));
    }
  }, []);

  // Called by ChatInput when user presses Send
  const handleSend = useCallback((text: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // First ensure IDE has latest text
      socketRef.current.send(JSON.stringify({ type: 'input', text }));
      // Then click Send
      socketRef.current.send(JSON.stringify({ type: 'send' }));
    }
  }, []);

  const triggerNewChat = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'new_chat' }));
    }
  }, []);

  const openHistory = useCallback(() => {
    setShowModelDropdown(false);
    setSearchQuery('');
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'list_conversations' }));
    }
  }, []);

  const selectConversation = useCallback((id: string) => {
    setShowHistoryDropdown(false);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setSwitchingConversation(true);
      socketRef.current.send(JSON.stringify({ type: 'select_conversation', id }));
    }
  }, []);

  const confirmSwitch = useCallback((option: { label: string; description: string }, index: number) => {
    setSwitchOptions(null);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && pendingSwitchId) {
      setSwitchingConversation(true);
      const fullText = (option.label + ' ' + option.description).trim();
      socketRef.current.send(
        JSON.stringify({
          type: 'confirm_switch',
          id: pendingSwitchId,
          optionText: fullText,
          optionIndex: index
        })
      );
    }
  }, [pendingSwitchId]);

  const cancelSwitch = useCallback(() => {
    setSwitchOptions(null);
    setPendingSwitchId(null);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'cancel_switch' }));
    }
  }, []);

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
    setShowModelDropdown(false);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'change_model', model }));
    }
  }, []);

  const openQuota = useCallback(() => {
    setShowQuota(true);
    setQuotaModels(null);
    setQuotaLoading(true);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'get_quota' }));
    }
  }, []);

  const triggerLogIn = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'log_in' }));
    }
  }, []);

  const triggerLogOut = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'log_out' }));
    }
  }, []);

  const handleOauthCallback = useCallback((code: string, state: string, port: number) => {
    setOauthUrl(null);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'oauth_callback', code, state, port }));
    }
  }, []);

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  if (!connected) {
    return (
      <>
        {Platform.OS === 'web' && (
          <style>
            {`
              ::-webkit-scrollbar { width: 6px; height: 6px; }
              ::-webkit-scrollbar-track { background: #0d1117; }
              ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
              ::-webkit-scrollbar-thumb:hover { background: #8b949e; }
            `}
          </style>
        )}
        <SetupScreen
          ipAddress={ipAddress}
          setIpAddress={setIpAddress}
          errorMsg={errorMsg}
          connecting={connecting}
          connectToBridge={connectToBridge}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === 'web' && (
        <style>
          {`
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: #0d1117; }
            ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: #8b949e; }
          `}
        </style>
      )}
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Header
          openHistory={openHistory}
          triggerNewChat={triggerNewChat}
          disconnectBridge={disconnectBridge}
          triggerLogIn={triggerLogIn}
          triggerLogOut={triggerLogOut}
          loggedInUser={loggedInUser}
          onUsernameTap={openQuota}
        />

        <HistoryPanel
          showHistoryDropdown={showHistoryDropdown}
          setShowHistoryDropdown={setShowHistoryDropdown}
          conversations={conversations}
          selectConversation={selectConversation}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {switchOptions && (
          <View style={styles.historyOverlay}>
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={cancelSwitch}
            />
            <View style={[styles.historyPanel, {
              width: 320,
              padding: 0,
              overflow: 'hidden',
              backgroundColor: '#161b22',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#30363d'
            }]}>
              {switchOptions.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#21262d',
                    backgroundColor: '#161b22',
                  }}
                  activeOpacity={0.7}
                  onPress={() => confirmSwitch(opt, idx)}
                >
                  <Text style={{ color: '#58a6ff', fontSize: 13, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                  {opt.description ? (
                    <Text style={{ color: '#8b949e', fontSize: 11, marginTop: 2 }}>
                      {opt.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  backgroundColor: '#161b22',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.7}
                onPress={cancelSwitch}
              >
                <Text style={{ color: '#ff7b72', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {switchingConversation && (
          <View style={styles.switchingBanner}>
            <ActivityIndicator size="small" color="#58a6ff" />
            <Text style={styles.switchingText}>Switching conversation...</Text>
          </View>
        )}

        {switchedToTitle && (
          <View style={[styles.switchingBanner, { backgroundColor: '#1a2d1a', borderBottomColor: '#2ea043' }]}>
            <Text style={{ fontSize: 12, marginRight: 6 }}>💬</Text>
            <Text style={[styles.switchingText, { color: '#3fb950' }]} numberOfLines={1}>
              Switched: {switchedToTitle}
            </Text>
          </View>
        )}

        <MessageFeed
          messages={messages}
          scrollViewRef={scrollViewRef}
        />

        <ChatInput
          ref={chatInputRef}
          onTextChange={handleTextChange}
          onSend={handleSend}
          selectedModel={selectedModel}
          showModelDropdown={showModelDropdown}
          setShowModelDropdown={toggleModelDropdown}
          models={models}
          handleModelSelect={handleModelSelect}
        />
      </KeyboardAvoidingView>

      {oauthUrl && (
        <OAuthWebView
          url={oauthUrl}
          onCallback={handleOauthCallback}
          onClose={() => setOauthUrl(null)}
        />
      )}

      {showQuota && (
        <QuotaPanel
          models={quotaModels}
          loading={quotaLoading}
          userTier={quotaTier}
          onClose={() => setShowQuota(false)}
        />
      )}
    </SafeAreaView>
  );
}
