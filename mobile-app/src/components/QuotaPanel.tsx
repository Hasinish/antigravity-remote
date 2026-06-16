import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, ActivityIndicator, Platform } from 'react-native';

interface QuotaModel {
  label: string;
  remainingFraction: number | null;
  resetTime: string | null;
}

interface QuotaPanelProps {
  models: QuotaModel[] | null;
  loading: boolean;
  userTier: string | null;
  onClose: () => void;
}

function formatReset(resetTime: string | null): string {
  if (!resetTime) return '';
  try {
    const diff = new Date(resetTime).getTime() - Date.now();
    if (diff <= 0) return 'Refreshing soon';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `Refreshes in ${h} hours, ${m} minutes` : `Refreshes in ${m} minutes`;
  } catch { return ''; }
}

export const QuotaPanel: React.FC<QuotaPanelProps> = ({ models, loading, userTier, onClose }) => (
  <Modal animationType="fade" transparent visible onRequestClose={onClose}>
    <View style={s.overlay}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.panel}>
        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>Model Quota</Text>
            {userTier ? <Text style={s.tier}>{userTier}</Text> : null}
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color="#a1a1aa" />
          </View>
        ) : (
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {(models || []).map((m, i) => {
              const pct = m.remainingFraction !== null ? Math.round(m.remainingFraction * 100) : null;
              return (
                <View key={i} style={s.row}>
                  <View style={s.rowTop}>
                    <Text style={s.modelName}>{m.label}</Text>
                    <Text style={s.resetText}>{formatReset(m.resetTime)}</Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${pct ?? 0}%` as any }]} />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  </Modal>
);

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    width: Platform.OS === 'web' ? 480 : '92%',
    maxHeight: '75%',
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f22',
  },
  title: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '700',
  },
  tier: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#71717a',
    fontSize: 15,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1f',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  modelName: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  resetText: {
    color: '#52525b',
    fontSize: 11,
    flexShrink: 0,
  },
  barBg: {
    height: 3,
    backgroundColor: '#27272a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    backgroundColor: '#a1a1aa',
    borderRadius: 2,
  },
});
