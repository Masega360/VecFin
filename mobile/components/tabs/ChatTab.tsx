import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Linking, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { API_URL, getValidToken } from '@/utils/api';

type Session = { id: string; title: string; created_at: string };
type Message = { id: string; role: 'user' | 'model'; content: string; provider?: string; created_at: string };

// Extracts markdown links and raw URLs, renders them as news cards
function ChatMessageContent({ content }: { content: string }) {
  // Match markdown links [title](url) OR raw URLs (with optional surrounding parens/quotes)
  const combinedRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\(?(https?:\/\/[^\s)]+)\)?/g;
  const parts: { type: 'text' | 'link'; text: string; url?: string; title?: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    const url = match[2] || match[3];
    const title = match[1] || url.replace(/https?:\/\/(finance\.)?yahoo\.com\/(.*?)\/articles\//, '').replace(/-/g, ' ').slice(0, 80);
    parts.push({ type: 'link', text: title, title, url });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return (
    <View>
      {parts.map((part, i) => {
        if (part.type === 'link' && part.url) {
          return (
            <TouchableOpacity
              key={i}
              style={styles.newsInlineCard}
              onPress={() => Linking.openURL(part.url!)}
            >
              <MaterialIcons name="article" size={18} color="#00ADD8" />
              <Text style={styles.newsInlineTitle} numberOfLines={2}>{part.title}</Text>
              <MaterialIcons name="open-in-new" size={14} color="#4a6a80" />
            </TouchableOpacity>
          );
        }
        return part.text.trim() ? (
          <Markdown key={i} style={markdownStyles}>{part.text}</Markdown>
        ) : null;
      })}
    </View>
  );
}

export default function ChatTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadSessions = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/chat/sessions`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setSessions(await res.json());
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const openSession = useCallback(async (session: Session) => {
    setActiveSession(session);
    setLoading(true);
    const token = await getValidToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/chat/sessions/${session.id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setMessages(await res.json());
    setLoading(false);
  }, []);

  const createSession = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/chat/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nueva conversación' }),
    });
    if (res.ok) {
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      openSession(session);
    }
  }, [openSession]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeSession || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    const token = await getValidToken();
    if (!token) { setSending(false); return; }

    const res = await fetch(`${API_URL}/chat/sessions/${activeSession.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });

    if (res.ok) {
      const reply: Message = await res.json();
      setMessages(prev => [...prev.filter(m => m.id !== tempId), { ...tempMsg, id: `user-${Date.now()}` }, reply]);
    }
    setSending(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, activeSession, sending]);

  // ─── Session list ──────────────────────────────────────────────────────────
  if (!activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Conversaciones</Text>
          <TouchableOpacity style={styles.newBtn} onPress={createSession}>
            <MaterialIcons name="add" size={20} color="#00ADD8" />
            <Text style={styles.newBtnText}>Nueva</Text>
          </TouchableOpacity>
        </View>
        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="chat-bubble-outline" size={48} color="#1e3a5a" />
            <Text style={styles.emptyText}>No hay conversaciones aún</Text>
            <TouchableOpacity style={styles.newBtnLarge} onPress={createSession}>
              <Text style={styles.newBtnText}>Iniciar conversación</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.sessionItem} onPress={() => openSession(item)}>
                <MaterialIcons name="chat" size={20} color="#4a6a80" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle}>{item.title}</Text>
                  <Text style={styles.sessionDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#2a4a60" />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ─── Chat view ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => { setActiveSession(null); setMessages([]); }}>
          <MaterialIcons name="arrow-back" size={22} color="#e2e8f0" />
        </TouchableOpacity>
        <Text style={styles.chatTitle} numberOfLines={1}>{activeSession.title}</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#00ADD8" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleModel]}>
              {item.role === 'model' ? (
                <>
                  <ChatMessageContent content={item.content} />
                  {item.provider && (
                    <Text style={styles.providerLabel}>{item.provider}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.bubbleTextUser}>{item.content}</Text>
              )}
            </View>
          )}
        />
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribí tu consulta..."
          placeholderTextColor="#2a4a60"
          multiline
          blurOnSubmit={true}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sending}>
          {sending
            ? <ActivityIndicator size="small" color="#00ADD8" />
            : <MaterialIcons name="send" size={20} color="#00ADD8" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const markdownStyles = {
  body: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  code_inline: { backgroundColor: '#0a1628', color: '#00ADD8', borderRadius: 4, paddingHorizontal: 4 },
  fence: { backgroundColor: '#0a1628', borderRadius: 8, padding: 8 },
  code_block: { color: '#e2e8f0', fontSize: 13 },
  strong: { color: '#fff' },
  link: { color: '#00ADD8' },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Session list
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#132238' },
  listTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newBtnLarge: { marginTop: 12, backgroundColor: '#132238', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  newBtnText: { color: '#00ADD8', fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#4a6a80', fontSize: 14 },
  sessionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#0f2035' },
  sessionTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  sessionDate: { color: '#4a6a80', fontSize: 12, marginTop: 2 },
  // Chat
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#132238' },
  chatTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', flex: 1 },
  messageList: { padding: 16, gap: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#00ADD8' },
  bubbleModel: { alignSelf: 'flex-start', backgroundColor: '#0f2035', borderWidth: 1, borderColor: '#132238' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#fff', fontSize: 14, lineHeight: 20 },
  providerLabel: { color: '#2a4a60', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 6 },
  bubbleTextModel: { color: '#e2e8f0' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#132238' },
  input: { flex: 1, backgroundColor: '#0f2035', color: '#e2e8f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#132238' },
  sendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  newsInlineCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a1628', borderRadius: 10, padding: 10, marginVertical: 6, gap: 8, borderWidth: 1, borderColor: '#132238' },
  newsInlineTitle: { flex: 1, color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
});
