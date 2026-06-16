import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles';

interface HeaderProps {
  openHistory: () => void;
  triggerNewChat: () => void;
  disconnectBridge: () => void;
  triggerLogIn: () => void;
  triggerLogOut: () => void;
  loggedInUser: string | null;
  onUsernameTap: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  openHistory,
  triggerNewChat,
  disconnectBridge,
  triggerLogIn,
  triggerLogOut,
  loggedInUser,
  onUsernameTap,
}) => {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Antigravity Chat</Text>
        {loggedInUser ? (
          <TouchableOpacity onPress={onUsernameTap} activeOpacity={0.7}>
            <Text style={styles.statusText}>● {loggedInUser} ›</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.statusText}>● Connected to PC</Text>
        )}
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.historyBtn} onPress={openHistory}>
          <Text style={styles.historyBtnText}>🕐</Text>
        </TouchableOpacity>
        {loggedInUser ? (
          <TouchableOpacity style={styles.logOutBtn} onPress={triggerLogOut}>
            <Text style={styles.logOutBtnText}>Log Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.logInBtn} onPress={triggerLogIn}>
            <Text style={styles.logInBtnText}>Log In</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.newChatBtn} onPress={triggerNewChat}>
          <Text style={styles.newChatBtnText}>+ New</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectBridge}>
          <Text style={styles.disconnectBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
