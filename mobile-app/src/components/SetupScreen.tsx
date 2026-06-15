import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { styles } from '../styles';

interface SetupScreenProps {
  ipAddress: string;
  setIpAddress: (ip: string) => void;
  errorMsg: string;
  connecting: boolean;
  connectToBridge: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
  ipAddress,
  setIpAddress,
  errorMsg,
  connecting,
  connectToBridge,
}) => {
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
};
