import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { styles } from '../styles';

export interface ChatInputHandle {
  /** Set the input text from outside (e.g. IDE→App sync) without re-rendering App */
  setTextExternal: (text: string) => void;
}

interface ChatInputProps {
  /** Called when the user types — debounced, only used for WebSocket sync */
  onTextChange: (text: string) => void;
  /** Called when user presses Send */
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
  const [text, setText] = useState('');
  const syncTimeout = useRef<any>(null);
  const lastSent = useRef('');
  const isFromIDE = useRef(false);

  // Expose a method to parent so the IDE can push text in without re-rendering App
  useImperativeHandle(ref, () => ({
    setTextExternal(newText: string) {
      isFromIDE.current = true;
      setText(newText);
      lastSent.current = newText;
    },
  }));

  const handleChangeText = useCallback((newText: string) => {
    setText(newText);

    // IDE-originated update — don't echo back
    if (isFromIDE.current) {
      isFromIDE.current = false;
      lastSent.current = newText;
      return;
    }

    // Debounce the WebSocket sync by 100 ms
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      if (newText !== lastSent.current) {
        lastSent.current = newText;
        onTextChange(newText);
      }
    }, 100);
  }, [onTextChange]);

  const handleKeyPress = useCallback((e: any) => {
    const key = e.nativeEvent?.key ?? e.key;
    const shiftKey = e.nativeEvent?.shiftKey ?? e.shiftKey;
    if (key === 'Enter' && !shiftKey) {
      e.preventDefault?.();
      handleSend();
    }
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Cancel pending debounce so the send includes the very latest text
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    lastSent.current = '';
    onSend(text);
    setText('');
  }, [text, onSend]);

  return (
    <View style={styles.inputArea}>
      <View style={styles.inputContainer}>
        {showModelDropdown && (
          <View style={styles.dropdownMenu}>
            {models.map((model) => (
              <TouchableOpacity
                key={model}
                style={styles.dropdownItem}
                activeOpacity={0.7}
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

        <TextInput
          style={styles.chatInput}
          value={text}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          placeholder="Ask anything, @ to mention, / for actions"
          placeholderTextColor="#71717a"
          multiline
        />

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
      </View>
    </View>
  );
});
