import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b' // Zinc-950 (IDE page background)
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#09090b'
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1.5,
    marginBottom: 8
  },
  subtitleText: {
    fontSize: 14,
    color: '#a1a1aa', // Zinc-400
    marginBottom: 32,
    textAlign: 'center'
  },
  card: {
    width: '100%',
    backgroundColor: '#18181b', // Zinc-900 (IDE component background)
    borderWidth: 1,
    borderColor: '#27272a', // Zinc-800
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  label: {
    color: '#e4e4e7', // Zinc-200
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    color: '#f4f4f5',
    padding: 12,
    fontSize: 15,
    marginBottom: 16
  },
  errorText: {
    color: '#f87171', // Red-400
    fontSize: 13,
    marginBottom: 16
  },
  connectButton: {
    backgroundColor: '#ffffff', // Clean white button for a premium look
    borderRadius: 8,
    padding: 14,
    alignItems: 'center'
  },
  connectButtonText: {
    color: '#09090b',
    fontSize: 15,
    fontWeight: '700'
  },
  header: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#09090b'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600'
  },
  statusText: {
    color: '#4ade80', // Green-400
    fontSize: 11,
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  historyBtnText: {
    fontSize: 13
  },
  historyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 11, 0.8)',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  historyPanel: {
    width: Platform.OS === 'web' ? 480 : '90%',
    maxHeight: '70%',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  historySearchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#18181b',
  },
  historySearchInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    color: '#f4f4f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      } as any,
    }),
  },
  historyList: {
    maxHeight: 400,
    backgroundColor: '#18181b',
  },
  historySection: {
    marginBottom: 4,
  },
  historySectionHeader: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    letterSpacing: 1,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  historyItemActive: {
    backgroundColor: '#27272a',
  },
  historyActiveIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#ffffff',
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    color: '#e4e4e7',
    fontSize: 13,
    lineHeight: 18,
  },
  historyItemTitleActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  historyItemMeta: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 2,
  },
  historyEmptyText: {
    color: '#a1a1aa',
    fontSize: 13,
    padding: 24,
    textAlign: 'center',
  },
  switchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  switchingText: {
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 8
  },
  newChatBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8
  },
  newChatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  disconnectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#f87171',
    borderRadius: 6
  },
  disconnectBtnText: {
    color: '#f87171',
    fontSize: 12
  },
  modelBar: {
    zIndex: 10,
    backgroundColor: '#09090b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  modelSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  modelSelectorText: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '500'
  },
  dropdownArrow: {
    color: '#a1a1aa',
    fontSize: 10
  },
  dropdownMenu: {
    position: 'absolute',
    bottom: 70, // Float above the input actions row inside the input area!
    left: 8,
    right: 8,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 200
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a'
  },
  dropdownItemText: {
    color: '#a1a1aa',
    fontSize: 13
  },
  dropdownItemTextSelected: {
    color: '#ffffff',
    fontWeight: '600'
  },
  feed: {
    flex: 1
  },
  feedContent: {
    padding: 16,
    paddingBottom: 32
  },
  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120
  },
  emptyText: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center'
  },
  userMessageContainer: {
    width: '100%',
    marginBottom: 20
  },
  userBubble: {
    backgroundColor: '#18181b', // Zinc-900 dark bubble
    borderWidth: 1,
    borderColor: '#27272a', // Zinc-800 border
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    maxWidth: '100%'
  },
  modelMessageContainer: {
    marginBottom: 24
  },
  modelHeaderRow: {
    marginBottom: 6
  },
  modelNameText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  modelBubble: {
    backgroundColor: 'transparent', // Plain text directly on bg!
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    maxWidth: '100%'
  },
  messageText: {
    color: '#f4f4f5', // Zinc-100
    fontSize: 14,
    lineHeight: 22
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8
  },
  activityIcon: {
    fontSize: 12,
    marginRight: 6
  },
  activityText: {
    color: '#a1a1aa',
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1
  },
  activityRowError: {
    backgroundColor: '#3b1616',
    borderColor: '#ef4444'
  },
  activityTextError: {
    color: '#fca5a5'
  },
  activityRowRunning: {
    borderColor: '#f59e0b'
  },
  activityTextRunning: {
    color: '#fcd34d'
  },
  inputArea: {
    padding: 16,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  inputContainer: {
    backgroundColor: '#18181b', // Zinc-900 container
    borderWidth: 1,
    borderColor: '#27272a', // Zinc-800 border
    borderRadius: 16,
    padding: 8,
  },
  chatInput: {
    backgroundColor: 'transparent',
    color: '#f4f4f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 40,
    maxHeight: 120,
    textAlignVertical: 'top',
    ...Platform.select({
      web: {
        outlineWidth: 0,
      } as any,
    }),
  },
  inputActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    marginTop: 4,
  },
  inputActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  actionButtonText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputModelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  inputModelSelectorText: {
    color: '#e4e4e7',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 4,
  },
  inputModelSelectorArrow: {
    color: '#a1a1aa',
    fontSize: 9,
  },
  sendButton: {
    width: 50,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#09090b',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
