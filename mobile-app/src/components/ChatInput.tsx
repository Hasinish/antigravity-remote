import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, Platform } from 'react-native';
import { styles } from '../styles';

export interface ChatInputHandle {
  setTextExternal: (text: string) => void;
}

interface ChatInputProps {
  onTextChange: (text: string) => void;
  onSend: (text: string) => void;
  selectedModel: string;
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  models: string[];
  handleModelSelect: (model: string) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({
  onTextChange,
  onSend,
  selectedModel,
  showModelDropdown,
  setShowModelDropdown,
  models,
  handleModelSelect,
}, ref) => {
  // On web: use a raw DOM ref — no React controlled state at all, zero re-renders per keystroke
  const nativeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // On native: use a TextInput ref for reading value
  const nativeInputRef = useRef<TextInput | null>(null);
  const nativeTextValue = useRef('');

  const syncTimeout = useRef<any>(null);
  const lastSent = useRef('');

  useImperativeHandle(ref, () => ({
    setTextExternal(newText: string) {
      lastSent.current = newText;
      if (Platform.OS === 'web' && nativeTextareaRef.current) {
        // Write directly to DOM — no React re-render at all
        nativeTextareaRef.current.value = newText;
      } else {
        nativeTextValue.current = newText;
      }
    },
  }));

  const scheduleSync = useCallback((text: string) => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      if (text !== lastSent.current) {
        lastSent.current = text;
        onTextChange(text);
      }
    }, 80);
  }, [onTextChange]);

  const handleSend = useCallback(() => {
    const text = Platform.OS === 'web'
      ? (nativeTextareaRef.current?.value ?? '')
      : nativeTextValue.current;

    if (!text.trim()) return;
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    lastSent.current = '';

    onSend(text);

    // Clear input
    if (Platform.OS === 'web' && nativeTextareaRef.current) {
      nativeTextareaRef.current.value = '';
      nativeTextareaRef.current.style.height = '36px';
    } else {
      nativeTextValue.current = '';
    }
  }, [onSend]);

  const handleKeyDown = useCallback((e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const modelDropdown = showModelDropdown ? (
    <View style={styles.dropdownMenu}>
      {models.map((model) => (
        <TouchableOpacity
          key={model}
          style={styles.dropdownItem}
          activeOpacity={0.7}
          onPress={() => handleModelSelect(model)}
        >
          <Text style={[
            styles.dropdownItemText,
            selectedModel === model && styles.dropdownItemTextSelected
          ]}>
            {model}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  const actionsRow = (
    <View style={styles.inputActionsRow}>
      <View style={styles.inputActionsLeft}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
          <Text style={styles.actionButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.inputModelSelector}
          activeOpacity={0.7}
          onPress={() => setShowModelDropdown(!showModelDropdown)}
        >
          <Text style={styles.inputModelSelectorText}>{selectedModel}</Text>
          <Text style={styles.inputModelSelectorArrow}>▼</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.sendButton} activeOpacity={0.7} onPress={handleSend}>
        <Text style={styles.sendBtnText}>Send</Text>
      </TouchableOpacity>
    </View>
  );

  if (Platform.OS === 'web') {
    // Fully uncontrolled native textarea — browser handles all rendering, zero React overhead
    return (
      <View style={styles.inputArea}>
        <View style={styles.inputContainer}>
          {modelDropdown}
          {/* @ts-ignore — native textarea element, not a React Native component */}
          <textarea
            ref={nativeTextareaRef}
            rows={1}
            placeholder="Ask anything, @ to mention, / for actions"
            onInput={(e: any) => {
              const el = e.target as HTMLTextAreaElement;
              // Auto-resize: collapse to auto first so shrinking works too
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 160) + 'px';
              scheduleSync(el.value);
            }}
            onKeyDown={handleKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e6edf3',
              fontSize: 14,
              fontFamily: 'Inter, system-ui, sans-serif',
              resize: 'none',
              width: '100%',
              padding: '8px 4px',
              height: '36px',
              maxHeight: '160px',
              overflowY: 'auto',
              lineHeight: '1.5',
              boxSizing: 'border-box',
            }}
          />
          {actionsRow}
        </View>
      </View>
    );
  }

  // Native iOS/Android — TextInput is fine here (native rendering is fast)
  return (
    <View style={styles.inputArea}>
      <View style={styles.inputContainer}>
        {modelDropdown}
        <TextInput
          ref={nativeInputRef}
          style={styles.chatInput}
          onChangeText={(text) => {
            nativeTextValue.current = text;
            scheduleSync(text);
          }}
          onKeyPress={(e: any) => {
            if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
              e.preventDefault?.();
              handleSend();
            }
          }}
          placeholder="Ask anything, @ to mention, / for actions"
          placeholderTextColor="#71717a"
          multiline
        />
        {actionsRow}
      </View>
    </View>
  );
});
