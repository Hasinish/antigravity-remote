import React from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { styles } from '../styles';
import { Conversation } from '../types';
import { formatRelativeTime } from '../utils/helpers';

interface HistoryPanelProps {
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: (show: boolean) => void;
  conversations: Conversation[];
  selectConversation: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = React.memo(({
  showHistoryDropdown,
  setShowHistoryDropdown,
  conversations,
  selectConversation,
  searchQuery,
  setSearchQuery,
}) => {
  if (!showHistoryDropdown) return null;

  const filteredConvos = conversations.filter((conv) =>
    (conv.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const runningConvos = filteredConvos.filter((c) => c.active);
  const recentConvos = filteredConvos.filter((c) => !c.active);

  return (
    <View style={styles.historyOverlay}>
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={() => setShowHistoryDropdown(false)} 
      />
      <View style={styles.historyPanel}>
        <View style={styles.historySearchContainer}>
          <TextInput
            style={styles.historySearchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search all convos..."
            placeholderTextColor="#8b949e"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <ScrollView style={styles.historyList} keyboardShouldPersistTaps="handled">
          {filteredConvos.length === 0 ? (
            <Text style={styles.historyEmptyText}>No matching conversations found.</Text>
          ) : (
            <>
              {runningConvos.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historySectionHeader}>Running</Text>
                  {runningConvos.map((conv) => (
                    <TouchableOpacity
                      key={conv.id}
                      style={[styles.historyItem, styles.historyItemActive]}
                      onPress={() => selectConversation(conv.id)}
                    >
                      <View style={styles.historyActiveIndicator} />
                      <View style={styles.historyItemContent}>
                        <Text style={[styles.historyItemTitle, styles.historyItemTitleActive]} numberOfLines={1}>
                          {conv.title}
                        </Text>
                        <Text style={styles.historyItemMeta}>
                          bots | {formatRelativeTime(conv.mtime)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {recentConvos.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historySectionHeader}>Recent</Text>
                  {recentConvos.map((conv) => (
                    <TouchableOpacity
                      key={conv.id}
                      style={styles.historyItem}
                      onPress={() => selectConversation(conv.id)}
                    >
                      <View style={styles.historyItemContent}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>
                          {conv.title}
                        </Text>
                        <Text style={styles.historyItemMeta}>
                          bots | {formatRelativeTime(conv.mtime)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
});
