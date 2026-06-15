import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { styles } from '../styles';

interface ChatInputProps {
  inputKey: number;
  inputText: string;
  handleTextChange: (text: string) => void;
  handleKeyPress: (e: any) => void;
  handleSend: () => void;
  selectedModel: string;
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  models: string[];
  handleModelSelect: (model: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputKey,
  inputText,
  handleTextChange,
  handleKeyPress,
  handleSend,
  selectedModel,
  showModelDropdown,
  setShowModelDropdown,
  models,
  handleModelSelect,
}) => {
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
          key={inputKey}
          style={styles.chatInput}
          value={inputText}
          onChangeText={handleTextChange}
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
};
