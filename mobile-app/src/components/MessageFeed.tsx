import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { styles } from '../styles';
import { Message } from '../types';
import { summarizeActivity } from '../utils/helpers';
import { MarkdownText } from './MarkdownText';

interface MessageFeedProps {
  messages: Message[];
  scrollViewRef: React.RefObject<ScrollView>;
}

export const MessageFeed: React.FC<MessageFeedProps> = ({
  messages,
  scrollViewRef,
}) => {
  return (
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
          const isUserChat = msg.source === 'USER_EXPLICIT' && msg.type === 'USER_INPUT';
          const isModelChat = msg.source === 'MODEL' && msg.type === 'PLANNER_RESPONSE' && !!msg.content;

          if (isUserChat) {
            let content = msg.content || '';
            const reqMatch = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
            if (reqMatch) {
              content = reqMatch[1].trim();
            } else {
              content = content.replace(/<([A-Z_]+)>[\s\S]*?<\/\1>/g, '').trim();
            }
            if (!content) return null;

            return (
              <View key={index} style={styles.userMessageContainer}>
                <View style={styles.userBubble}>
                  <MarkdownText content={content} />
                </View>
              </View>
            );
          }

          if (isModelChat) {
            return (
              <View key={index} style={styles.modelMessageContainer}>
                <View style={styles.modelHeaderRow}>
                  <Text style={styles.modelNameText}>AI Assistant</Text>
                </View>
                <View style={styles.modelBubble}>
                  <MarkdownText content={msg.content} />
                </View>
              </View>
            );
          }

          const activity = summarizeActivity(msg, index === messages.length - 1);
          if (!activity) return null;

          return (
            <View
              key={index}
              style={[
                styles.activityRow,
                activity.variant === 'error' && styles.activityRowError,
                activity.variant === 'running' && styles.activityRowRunning
              ]}
            >
              <Text style={styles.activityIcon}>{activity.icon}</Text>
              <Text
                style={[
                  styles.activityText,
                  activity.variant === 'error' && styles.activityTextError,
                  activity.variant === 'running' && styles.activityTextRunning
                ]}
              >
                {activity.text}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};
