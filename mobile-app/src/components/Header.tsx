import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles';

interface HeaderProps {
  openHistory: () => void;
  triggerNewChat: () => void;
  disconnectBridge: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  openHistory,
  triggerNewChat,
  disconnectBridge,
}) => {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Antigravity Chat</Text>
        <Text style={styles.statusText}>● Connected to PC</Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.historyBtn} onPress={openHistory}>
          <Text style={styles.historyBtnText}>🕐</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newChatBtn} onPress={triggerNewChat}>
          <Text style={styles.newChatBtnText}>+ New Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectBridge}>
          <Text style={styles.disconnectBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
