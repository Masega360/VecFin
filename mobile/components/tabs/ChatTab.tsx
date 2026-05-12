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

// Extracts markdown links and raw URLs, renders them as rich news cards
function ChatMessageContent({ content }: { content: string }) {
  // Match markdown links [title](url) — greedy on URL to catch full paths
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  // First pass: extract all links
  const links: { title: string; url: string; start: number; end: number }[] = [];
  let match;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    links.push({ title: match[1], url: match[2], start: match.index, end: match.index + match[0].length });
  }

  // Also match raw URLs not inside markdown links
  const rawUrlRegex = /(?<!\()(https?:\/\/[^\s)<>]+)/g;
  while ((match = rawUrlRegex.exec(content)) !== null) {
    const overlaps = links.some(l => match!.index >= l.start && match!.index < l.end);
    if (!overlaps) {
      const url = match[1];
      const title = url.split('/').pop()?.replace(/-/g, ' ').replace(/\.html$/, '').slice(0, 60) || 'Ver noticia';
      links.push({ title, url, start: match.index, end: match.index + match[0].length });
    }
  }

  links.sort((a, b) => a.start - b.start);

  if (links.length === 0) {
    return <Markdown style={markdownStyles}>{content}</Markdown>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  links.forEach((link, i) => {
    if (link.start > lastIndex) {
      const text = content.slice(lastIndex, link.start).trim();
      if (text) parts.push(<Markdown key={`t${i}`} style={markdownStyles}>{text}</Markdown>);
    }
    parts.push(
      <TouchableOpacity key={`l${i}`} style={styles.newsInlineCard} onPress={() => Linking.openURL(link.url)}>
        <View style={styles.newsIconBg}>
          <MaterialIcons name="newspaper" size={20} color="#00ADD8" />
        </View>
        <View style={styles.newsInlineBody}>
          <Text style={styles.newsInlineTitle} numberOfLines={2}>{link.title}</Text>
          <Text style={styles.newsInlineSource} numberOfLines={1}>
            {link.url.match(/\/\/([^/]+)/)?.[1]?.replace('www.', '') || ''}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color="#4a6a80" />
      </TouchableOpacity>
    );
    lastIndex = link.end;
  });
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push(<Markdown key="end" style={markdownStyles}>{text}</Markdown>);
  }

  return <View>{parts}</View>;
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
  newsInlineCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a1628', borderRadius: 12, padding: 12, marginVertical: 6, gap: 10, borderWidth: 1, borderColor: '#1e3a5a' },
  newsIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#132238', justifyContent: 'center', alignItems: 'center' },
  newsInlineBody: { flex: 1, gap: 2 },
  newsInlineTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', lineHeight: 17 },
  newsInlineSource: { color: '#00ADD8', fontSize: 10, fontWeight: '500' },
});
