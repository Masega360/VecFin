import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, Modal, ScrollView,
    RefreshControl, Platform, SafeAreaView, Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { API_URL, getValidToken } from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
    id: string; community_id: string; author_id: string; author_name: string;
    title: string; content: string; url: string;
    upvotes: number; downvotes: number; comment_count: number;
    created_at: string; updated_at: string; user_vote: boolean | null;
}

interface Member {
    community_id: string; user_id: string; role: string;
    joined_at: string; first_name: string; last_name: string;
}

interface JoinRequest {
    community_id: string; user_id: string; status: string; created_at: string;
}

type Reply = Post;
type DetailTab = 'posts' | 'about' | 'manage';
type VoteState = 'up' | 'down' | null;

interface StackFrame {
    post: Post; replies: Reply[]; votes: Record<string, VoteState>;
    postVote: VoteState; postUpvotes: number; postDownvotes: number;
    loading: boolean; commentText: string; error: string;
}

const POST_TITLE_MAX = 32;
const POST_CONTENT_MAX = 1024;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authFetch(url: string, opts: RequestInit = {}) {
    const token = await getValidToken();
    return fetch(url, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
    });
}

// Extrae el userID del JWT guardado localmente
async function getMyUserID(): Promise<string> {
    try {
        const token = await getValidToken();
        if (!token) return '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id ?? payload.sub ?? '';
    } catch { return ''; }
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

function roleColor(role: string) {
    if (role === 'owner') return '#f5a623';
    if (role === 'moderator') return '#7b68ee';
    return '#7a9ab0';
}
function roleLabel(role: string) {
    if (role === 'owner') return 'Líder';
    if (role === 'moderator') return 'Mod';
    return 'Miembro';
}

function makeFrame(post: Post): StackFrame {
    return {
        post, replies: [], votes: {},
        postVote: post.user_vote === true ? 'up' : post.user_vote === false ? 'down' : null,
        postUpvotes: post.upvotes, postDownvotes: post.downvotes,
        loading: false, commentText: '', error: '',
    };
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmOpts {
    title: string; message: string; confirmLabel?: string;
    danger?: boolean; onConfirm: () => void; onCancel?: () => void;
}

function ConfirmDialog({ visible, title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel }: ConfirmOpts & { visible: boolean }) {
    if (!visible) return null;
    return (
        <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable style={cd.overlay} onPress={onCancel}>
                <Pressable style={cd.box} onPress={() => {}}>
                    <Text style={cd.title}>{title}</Text>
                    <Text style={cd.msg}>{message}</Text>
                    <View style={cd.row}>
                        <TouchableOpacity style={cd.cancelBtn} onPress={onCancel}><Text style={cd.cancelText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity style={[cd.confirmBtn, danger && cd.dangerBtn]} onPress={onConfirm}><Text style={cd.confirmText}>{confirmLabel}</Text></TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
const cd = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    box: { backgroundColor: '#0d1826', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#1a2d42', gap: 12 },
    title: { color: '#e8f4f8', fontWeight: '700', fontSize: 17 },
    msg: { color: '#7a9ab0', fontSize: 14, lineHeight: 21 },
    row: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#111e2e', borderWidth: 1, borderColor: '#1a2d42', alignItems: 'center' },
    cancelText: { color: '#7a9ab0', fontWeight: '600', fontSize: 14 },
    confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#00b4d8', alignItems: 'center' },
    dangerBtn: { backgroundColor: '#e05c5c' },
    confirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

function useConfirm() {
    const [state, setState] = useState<ConfirmOpts & { visible: boolean }>({ visible: false, title: '', message: '', onConfirm: () => {} });
    const show = (opts: ConfirmOpts) => setState({ ...opts, visible: true });
    const hide = () => setState(s => ({ ...s, visible: false }));
    return { state, show, hide };
}

// ─── Small UI ─────────────────────────────────────────────────────────────────

function TopicPill({ topic }: { topic: string }) {
    return <View style={s.topicPill}><Text style={s.topicPillText}>#{topic}</Text></View>;
}
function RoleBadge({ role }: { role: string }) {
    return (
        <View style={[s.roleBadge, { borderColor: roleColor(role) }]}>
            <Text style={[s.roleBadgeText, { color: roleColor(role) }]}>{roleLabel(role)}</Text>
        </View>
    );
}

// ─── Members Modal ────────────────────────────────────────────────────────────

function MembersModal({ visible, communityID, myRole, myUserID, onClose }: {
    visible: boolean; communityID: string; myRole: string; myUserID: string; onClose: () => void;
}) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');
    const { state: dlg, show: showDlg, hide: hideDlg } = useConfirm();

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await authFetch(`${API_URL}/communities/${communityID}/members`);
            if (res.ok) setMembers(await res.json() ?? []);
            else setError('No se pudo cargar la lista');
        } catch { setError('Sin conexión'); }
        finally { setLoading(false); }
    }, [communityID]);

    React.useEffect(() => { if (visible) { setMembers([]); load(); } }, [visible]);

    const canKick = (target: Member) => {
        if (target.user_id === myUserID) return false;
        if (myRole === 'owner') return target.role !== 'owner';
        if (myRole === 'moderator') return target.role === 'member';
        return false;
    };
    const canPromoteMod = (target: Member) => myRole === 'owner' && target.role === 'member' && target.user_id !== myUserID;
    const canDemoteMod = (target: Member) => myRole === 'owner' && target.role === 'moderator';
    const canTransfer = (target: Member) => myRole === 'owner' && target.user_id !== myUserID;

    const doAction = async (url: string, body: object, onSuccess: () => void) => {
        try {
            const res = await authFetch(url, { method: 'POST', body: JSON.stringify(body) });
            if (res.ok) onSuccess();
            else setError(await res.text());
        } catch { setError('Sin conexión'); }
        finally { setActionLoading(null); }
    };

    const doKick = (m: Member) => showDlg({
        title: 'Expulsar miembro',
        message: `¿Expulsar a ${m.first_name} ${m.last_name}?`,
        confirmLabel: 'Expulsar', danger: true, onCancel: hideDlg,
        onConfirm: () => { hideDlg(); setActionLoading(m.user_id); doAction(`${API_URL}/communities/${communityID}/kick`, { target_id: m.user_id }, () => setMembers(prev => prev.filter(x => x.user_id !== m.user_id))); },
    });

    const doPromoteMod = (m: Member) => showDlg({
        title: 'Designar moderador',
        message: `¿Promover a ${m.first_name} ${m.last_name} a moderador?`,
        confirmLabel: 'Promover', onCancel: hideDlg,
        onConfirm: () => { hideDlg(); setActionLoading(m.user_id); doAction(`${API_URL}/communities/${communityID}/promote`, { target_id: m.user_id }, () => setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, role: 'moderator' } : x))); },
    });

    const doDemoteMod = (m: Member) => showDlg({
        title: 'Quitar moderador',
        message: `¿Quitar el rango de moderador a ${m.first_name} ${m.last_name}?`,
        confirmLabel: 'Quitar', danger: true, onCancel: hideDlg,
        onConfirm: () => { hideDlg(); setActionLoading(m.user_id); doAction(`${API_URL}/communities/${communityID}/demote`, { target_id: m.user_id }, () => setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, role: 'member' } : x))); },
    });

    const doTransfer = (m: Member) => showDlg({
        title: 'Transferir liderazgo',
        message: `¿Transferir el liderazgo a ${m.first_name} ${m.last_name}? Pasarás a ser moderador.`,
        confirmLabel: 'Transferir', danger: true, onCancel: hideDlg,
        onConfirm: () => {
            hideDlg(); setActionLoading(m.user_id);
            doAction(`${API_URL}/communities/${communityID}/transfer`, { target_id: m.user_id }, () => {
                setMembers(prev => prev.map(x => {
                    if (x.user_id === myUserID) return { ...x, role: 'moderator' };
                    if (x.user_id === m.user_id) return { ...x, role: 'owner' };
                    return x;
                }));
                onClose();
            });
        },
    });

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={mg.wrap}>
                <SafeAreaView style={mg.sheet}>
                    <View style={mg.header}>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <MaterialIcons name="arrow-back" size={22} color="#e8f4f8" />
                        </TouchableOpacity>
                        <Text style={mg.headerTitle}>Miembros ({members.length})</Text>
                        <TouchableOpacity onPress={load}><MaterialIcons name="refresh" size={20} color="#3d5a70" /></TouchableOpacity>
                    </View>

                    {error ? <View style={mg.errorBanner}><MaterialIcons name="error-outline" size={14} color="#e05c5c" /><Text style={mg.errorText}>{error}</Text></View> : null}

                    {loading ? <ActivityIndicator color="#00b4d8" style={{ marginTop: 40 }} /> : (
                        <FlatList
                            data={members} keyExtractor={m => m.user_id}
                            contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}
                            renderItem={({ item: m }) => (
                                <View style={mg.memberCard}>
                                    <View style={mg.memberAvatar}>
                                        <Text style={mg.memberAvatarTxt}>{m.first_name.charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={mg.memberName}>{m.first_name} {m.last_name}</Text>
                                            <RoleBadge role={m.role} />
                                        </View>
                                        <Text style={mg.memberSince}>Desde {timeAgo(m.joined_at)}</Text>
                                    </View>
                                    {actionLoading === m.user_id ? (
                                        <ActivityIndicator color="#00b4d8" size="small" />
                                    ) : (
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            {canPromoteMod(m) && <TouchableOpacity style={mg.actionBtn} onPress={() => doPromoteMod(m)}><MaterialIcons name="star-outline" size={16} color="#7b68ee" /></TouchableOpacity>}
                                            {canDemoteMod(m) && <TouchableOpacity style={mg.actionBtn} onPress={() => doDemoteMod(m)}><MaterialIcons name="star" size={16} color="#7b68ee" /></TouchableOpacity>}
                                            {canTransfer(m) && <TouchableOpacity style={mg.actionBtn} onPress={() => doTransfer(m)}><MaterialIcons name="swap-horiz" size={16} color="#f5a623" /></TouchableOpacity>}
                                            {canKick(m) && <TouchableOpacity style={[mg.actionBtn, { borderColor: '#e05c5c' }]} onPress={() => doKick(m)}><MaterialIcons name="person-remove" size={16} color="#e05c5c" /></TouchableOpacity>}
                                        </View>
                                    )}
                                </View>
                            )}
                            ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 60, gap: 10 }}><MaterialIcons name="people" size={48} color="#1e3a5a" /><Text style={{ color: '#3d5a70', fontSize: 14 }}>Sin miembros</Text></View>}
                        />
                    )}
                </SafeAreaView>
            </View>
            <ConfirmDialog {...dlg} />
        </Modal>
    );
}

// ─── Join Requests Modal ──────────────────────────────────────────────────────

function RequestsModal({ visible, communityID, onClose }: { visible: boolean; communityID: string; onClose: () => void }) {
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await authFetch(`${API_URL}/communities/${communityID}/requests`);
            if (res.ok) setRequests(await res.json() ?? []);
            else setError('No se pudo cargar las solicitudes');
        } catch { setError('Sin conexión'); }
        finally { setLoading(false); }
    }, [communityID]);

    React.useEffect(() => { if (visible) { setRequests([]); load(); } }, [visible]);

    const resolve = async (userID: string, approve: boolean) => {
        setActionLoading(userID);
        try {
            const res = await authFetch(`${API_URL}/communities/${communityID}/requests/resolve`, {
                method: 'POST', body: JSON.stringify({ applicant_id: userID, approve }),
            });
            if (res.ok) setRequests(prev => prev.filter(r => r.user_id !== userID));
            else setError(await res.text());
        } catch { setError('Sin conexión'); }
        finally { setActionLoading(null); }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={mg.wrap}>
                <SafeAreaView style={mg.sheet}>
                    <View style={mg.header}>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><MaterialIcons name="arrow-back" size={22} color="#e8f4f8" /></TouchableOpacity>
                        <Text style={mg.headerTitle}>Solicitudes pendientes</Text>
                        <TouchableOpacity onPress={load}><MaterialIcons name="refresh" size={20} color="#3d5a70" /></TouchableOpacity>
                    </View>
                    {error ? <View style={mg.errorBanner}><MaterialIcons name="error-outline" size={14} color="#e05c5c" /><Text style={mg.errorText}>{error}</Text></View> : null}
                    {loading ? <ActivityIndicator color="#00b4d8" style={{ marginTop: 40 }} /> : (
                        <FlatList data={requests} keyExtractor={r => r.user_id}
                                  contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}
                                  renderItem={({ item: r }) => (
                                      <View style={mg.memberCard}>
                                          <View style={mg.memberAvatar}><MaterialIcons name="person" size={18} color="#00b4d8" /></View>
                                          <View style={{ flex: 1 }}>
                                              <Text style={mg.memberName}>{r.user_id.slice(0, 8)}...</Text>
                                              <Text style={mg.memberSince}>Solicitó {timeAgo(r.created_at)}</Text>
                                          </View>
                                          {actionLoading === r.user_id ? <ActivityIndicator color="#00b4d8" size="small" /> : (
                                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                                  <TouchableOpacity style={[mg.actionBtn, { borderColor: '#34c78a' }]} onPress={() => resolve(r.user_id, true)}><MaterialIcons name="check" size={16} color="#34c78a" /></TouchableOpacity>
                                                  <TouchableOpacity style={[mg.actionBtn, { borderColor: '#e05c5c' }]} onPress={() => resolve(r.user_id, false)}><MaterialIcons name="close" size={16} color="#e05c5c" /></TouchableOpacity>
                                              </View>
                                          )}
                                      </View>
                                  )}
                                  ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 60, gap: 10 }}><MaterialIcons name="pending-actions" size={48} color="#1e3a5a" /><Text style={{ color: '#3d5a70', fontSize: 14 }}>Sin solicitudes pendientes</Text></View>}
                        />
                    )}
                </SafeAreaView>
            </View>
        </Modal>
    );
}

// ─── Edit Community Modal ─────────────────────────────────────────────────────

function EditCommunityModal({ visible, community, onClose, onSaved }: {
    visible: boolean;
    community: { id: string; name: string; description: string; rules: string };
    onClose: () => void;
    onSaved: (updated: { name: string; description: string; rules: string }) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [rules, setRules] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (visible) { setName(community.name); setDescription(community.description); setRules(community.rules); setError(''); }
    }, [visible]);

    const save = async () => {
        if (!name.trim()) { setError('El nombre es obligatorio'); return; }
        if (name.length > 64) { setError('Máximo 64 caracteres'); return; }
        setLoading(true); setError('');
        try {
            const res = await authFetch(`${API_URL}/communities/${community.id}`, {
                method: 'PUT', body: JSON.stringify({ name: name.trim(), description: description.trim(), rules: rules.trim() }),
            });
            if (res.ok) { onSaved({ name: name.trim(), description: description.trim(), rules: rules.trim() }); onClose(); }
            else setError(await res.text() || 'Error al guardar');
        } catch { setError('Sin conexión'); }
        finally { setLoading(false); }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={s.modalOverlay}>
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} keyboardShouldPersistTaps="handled">
                    <View style={[s.modalSheet, { paddingBottom: 48 }]}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Editar comunidad</Text>
                            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#7a9ab0" /></TouchableOpacity>
                        </View>
                        <View style={s.fieldGroup}>
                            <View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Nombre <Text style={s.required}>*</Text></Text><Text style={[s.charCount, (64 - name.length) < 10 && s.charWarn]}>{64 - name.length}</Text></View>
                            <TextInput style={s.modalInput} value={name} onChangeText={t => { setName(t); setError(''); }} maxLength={64} placeholderTextColor="#3d5a70" placeholder="Nombre de la comunidad" />
                        </View>
                        <View style={s.fieldGroup}>
                            <View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Descripción</Text><Text style={[s.charCount, (512 - description.length) < 50 && s.charWarn]}>{512 - description.length}</Text></View>
                            <TextInput style={[s.modalInput, { height: 90, paddingTop: 12 }]} value={description} onChangeText={setDescription} maxLength={512} multiline textAlignVertical="top" placeholderTextColor="#3d5a70" placeholder="Descripción" />
                        </View>
                        <View style={s.fieldGroup}>
                            <View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Reglas</Text><Text style={[s.charCount, (512 - rules.length) < 50 && s.charWarn]}>{512 - rules.length}</Text></View>
                            <TextInput style={[s.modalInput, { height: 90, paddingTop: 12 }]} value={rules} onChangeText={setRules} maxLength={512} multiline textAlignVertical="top" placeholderTextColor="#3d5a70" placeholder="Reglas" />
                        </View>
                        {error ? <View style={s.globalError}><MaterialIcons name="error-outline" size={14} color="#e05c5c" /><Text style={s.globalErrorText}>{error}</Text></View> : null}
                        <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.6 }]} onPress={save} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Guardar cambios</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

// ─── Thread Modal ─────────────────────────────────────────────────────────────

function ThreadModal({ visible, rootPost, isMember, onClose }: {
    visible: boolean; rootPost: Post | null; isMember: boolean; onClose: () => void;
}) {
    const [stack, setStack] = useState<StackFrame[]>([]);
    const scrollRef = useRef<ScrollView>(null);

    React.useEffect(() => {
        if (visible && rootPost) {
            const frame = makeFrame(rootPost);
            setStack([frame]);
            loadRepliesForIndex(0, rootPost.id);
        }
    }, [visible, rootPost?.id]);

    const loadRepliesForIndex = async (idx: number, postID: string) => {
        setStack(prev => prev.map((f, i) => i === idx ? { ...f, loading: true } : f));
        try {
            const res = await authFetch(`${API_URL}/posts/${postID}/replies`);
            if (res.ok) {
                const data: Reply[] = await res.json() ?? [];
                const initVotes: Record<string, VoteState> = {};
                data.forEach(r => {
                    if (r.user_vote === true) initVotes[r.id] = 'up';
                    else if (r.user_vote === false) initVotes[r.id] = 'down';
                });
                setStack(prev => prev.map((f, i) => i === idx ? { ...f, replies: data, votes: initVotes, loading: false } : f));
            } else setStack(prev => prev.map((f, i) => i === idx ? { ...f, loading: false } : f));
        } catch { setStack(prev => prev.map((f, i) => i === idx ? { ...f, loading: false } : f)); }
    };

    const pushReply = (reply: Reply) => {
        setStack(prev => { const next = [...prev, makeFrame(reply)]; setTimeout(() => loadRepliesForIndex(next.length - 1, reply.id), 0); return next; });
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    };
    const popStack = () => { if (stack.length <= 1) { onClose(); return; } setStack(prev => prev.slice(0, -1)); scrollRef.current?.scrollTo({ y: 0, animated: false }); };

    const handleVotePost = async (idx: number, isUpvote: boolean) => {
        const frame = stack[idx]; if (!frame) return;
        const current = frame.postVote;
        const newVote: VoteState = current === (isUpvote ? 'up' : 'down') ? null : (isUpvote ? 'up' : 'down');
        let up = frame.postUpvotes, down = frame.postDownvotes;
        if (current === 'up') up = Math.max(0, up - 1); if (current === 'down') down = Math.max(0, down - 1);
        if (newVote === 'up') up++; if (newVote === 'down') down++;
        setStack(prev => prev.map((f, i) => i === idx ? { ...f, postVote: newVote, postUpvotes: up, postDownvotes: down } : f));
        if (newVote !== null) {
            try { await authFetch(`${API_URL}/posts/${frame.post.id}/vote`, { method: 'POST', body: JSON.stringify({ is_upvote: isUpvote }) }); }
            catch { setStack(prev => prev.map((f, i) => i === idx ? { ...f, postVote: current, postUpvotes: frame.postUpvotes, postDownvotes: frame.postDownvotes } : f)); }
        }
    };

    const handleVoteReply = async (frameIdx: number, replyID: string, isUpvote: boolean) => {
        const frame = stack[frameIdx]; if (!frame) return;
        const current = frame.votes[replyID] ?? null;
        const newVote: VoteState = current === (isUpvote ? 'up' : 'down') ? null : (isUpvote ? 'up' : 'down');
        setStack(prev => prev.map((f, i) => {
            if (i !== frameIdx) return f;
            const updatedVotes = { ...f.votes, [replyID]: newVote };
            const updatedReplies = f.replies.map(r => {
                if (r.id !== replyID) return r;
                let { upvotes, downvotes } = r;
                if (current === 'up') upvotes = Math.max(0, upvotes - 1); if (current === 'down') downvotes = Math.max(0, downvotes - 1);
                if (newVote === 'up') upvotes++; if (newVote === 'down') downvotes++;
                return { ...r, upvotes, downvotes };
            });
            return { ...f, votes: updatedVotes, replies: updatedReplies };
        }));
        if (newVote !== null) {
            try { await authFetch(`${API_URL}/posts/${replyID}/vote`, { method: 'POST', body: JSON.stringify({ is_upvote: isUpvote }) }); }
            catch { setStack(prev => prev.map((f, i) => i !== frameIdx ? f : { ...f, votes: { ...f.votes, [replyID]: current } })); }
        }
    };

    const submitReply = async (idx: number) => {
        const frame = stack[idx]; if (!frame) return;
        const text = frame.commentText.trim();
        if (!text) { setStack(prev => prev.map((f, i) => i === idx ? { ...f, error: 'El comentario no puede estar vacío' } : f)); return; }
        setStack(prev => prev.map((f, i) => i === idx ? { ...f, error: '' } : f));
        try {
            const res = await authFetch(`${API_URL}/posts`, {
                method: 'POST',
                body: JSON.stringify({ community_id: frame.post.community_id, parent_id: frame.post.id, title: '', content: text, url: '' }),
            });
            if (res.ok) { setStack(prev => prev.map((f, i) => i === idx ? { ...f, commentText: '' } : f)); loadRepliesForIndex(idx, frame.post.id); }
            else { const msg = await res.text(); setStack(prev => prev.map((f, i) => i === idx ? { ...f, error: msg || 'Error al publicar' } : f)); }
        } catch { setStack(prev => prev.map((f, i) => i === idx ? { ...f, error: 'Sin conexión' } : f)); }
    };

    if (!rootPost || stack.length === 0) return null;
    const idx = stack.length - 1;
    const frame = stack[idx];
    const depth = idx;
    const charLeft = POST_CONTENT_MAX - frame.commentText.length;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={popStack}>
            <View style={th.wrap}>
                <SafeAreaView style={th.sheet}>
                    <View style={th.header}>
                        <TouchableOpacity onPress={popStack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <MaterialIcons name="arrow-back" size={22} color="#e8f4f8" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text style={th.headerTitle} numberOfLines={1}>{depth === 0 ? (frame.post.title || 'Post') : frame.post.author_name}</Text>
                            {depth > 0 && <Text style={th.headerSub} numberOfLines={1}>Respondiendo a {stack[depth - 1]?.post.author_name ?? ''}</Text>}
                        </View>
                        {depth > 0 && <View style={th.depthBadge}><Text style={th.depthText}>Niv. {depth + 1}</Text></View>}
                    </View>

                    <ScrollView ref={scrollRef} contentContainerStyle={th.scroll} keyboardShouldPersistTaps="handled">
                        <View style={th.postBox}>
                            <View style={s.postAuthorRow}>
                                <View style={[s.postAvatar, depth > 0 && { width: 30, height: 30, borderRadius: 9 }]}>
                                    <Text style={[s.postAvatarText, depth > 0 && { fontSize: 12 }]}>{frame.post.author_name?.charAt(0).toUpperCase() ?? '?'}</Text>
                                </View>
                                <View><Text style={s.postAuthor}>{frame.post.author_name}</Text><Text style={s.postTime}>{timeAgo(frame.post.created_at)}</Text></View>
                            </View>
                            {frame.post.title ? <Text style={[s.postTitle, { marginTop: 12 }]}>{frame.post.title}</Text> : null}
                            <Text style={[s.postContent, { marginTop: 8 }]}>{frame.post.content}</Text>
                            {frame.post.url ? <View style={[s.postUrlRow, { marginTop: 10 }]}><MaterialIcons name="link" size={13} color="#00b4d8" /><Text style={s.postUrl}>{frame.post.url}</Text></View> : null}
                            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1a2d42' }}>
                                <View style={th.voteBar}>
                                    <TouchableOpacity style={[th.voteBtn, frame.postVote === 'up' && th.voteBtnUp]} onPress={() => handleVotePost(idx, true)}>
                                        <MaterialIcons name="keyboard-arrow-up" size={20} color={frame.postVote === 'up' ? '#34c78a' : '#3d5a70'} />
                                        <Text style={[th.voteBtnTxt, frame.postVote === 'up' && { color: '#34c78a' }]}>{frame.postUpvotes}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[th.voteBtn, frame.postVote === 'down' && th.voteBtnDown]} onPress={() => handleVotePost(idx, false)}>
                                        <MaterialIcons name="keyboard-arrow-down" size={20} color={frame.postVote === 'down' ? '#e05c5c' : '#3d5a70'} />
                                        <Text style={[th.voteBtnTxt, frame.postVote === 'down' && { color: '#e05c5c' }]}>{frame.postDownvotes}</Text>
                                    </TouchableOpacity>
                                    <Text style={[th.score, { color: (frame.postUpvotes - frame.postDownvotes) >= 0 ? '#34c78a' : '#e05c5c', marginLeft: 'auto' }]}>
                                        {(frame.postUpvotes - frame.postDownvotes) > 0 ? '+' : ''}{frame.postUpvotes - frame.postDownvotes}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={th.dividerRow}>
                            <Text style={th.dividerText}>{frame.loading ? 'Cargando...' : frame.replies.length > 0 ? `${frame.replies.length} respuesta${frame.replies.length !== 1 ? 's' : ''}` : 'Sin respuestas aún'}</Text>
                        </View>

                        {frame.loading ? <ActivityIndicator color="#00b4d8" style={{ marginTop: 20 }} /> :
                            frame.replies.length === 0 ? <View style={th.emptyBox}><MaterialIcons name="chat-bubble-outline" size={36} color="#1e3a5a" /><Text style={th.emptyText}>Sé el primero en responder</Text></View> :
                                frame.replies.map(r => (
                                    <ReplyCard key={r.id} reply={r} voteState={frame.votes[r.id] ?? null}
                                               onVote={(up) => handleVoteReply(idx, r.id, up)} onPress={() => pushReply(r)} />
                                ))}
                        <View style={{ height: 130 }} />
                    </ScrollView>

                    {isMember && (
                        <View style={th.inputArea}>
                            {frame.error ? <View style={th.errorRow}><MaterialIcons name="error-outline" size={13} color="#e05c5c" /><Text style={th.errorText}>{frame.error}</Text></View> : null}
                            <View style={th.inputRow}>
                                <TextInput style={th.input} placeholder={depth === 0 ? 'Escribí un comentario...' : 'Responder...'} placeholderTextColor="#3d5a70"
                                           value={frame.commentText} onChangeText={t => setStack(prev => prev.map((f, i) => i === idx ? { ...f, commentText: t, error: '' } : f))}
                                           multiline maxLength={POST_CONTENT_MAX} />
                                <View style={th.inputRight}>
                                    <Text style={[th.charCount, charLeft < 100 && { color: '#f5a623' }]}>{charLeft}</Text>
                                    <TouchableOpacity style={[th.sendBtn, !frame.commentText.trim() && th.sendDisabled]} onPress={() => submitReply(idx)} disabled={!frame.commentText.trim()}>
                                        <MaterialIcons name="send" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </SafeAreaView>
            </View>
        </Modal>
    );
}

function ReplyCard({ reply, voteState, onVote, onPress }: { reply: Reply; voteState: VoteState; onVote: (up: boolean) => void; onPress: () => void }) {
    const score = reply.upvotes - reply.downvotes;
    return (
        <TouchableOpacity style={th.replyCard} onPress={onPress} activeOpacity={0.8}>
            <View style={th.replyHeader}>
                <View style={th.replyAvatar}><Text style={th.replyAvatarTxt}>{reply.author_name?.charAt(0).toUpperCase() ?? '?'}</Text></View>
                <View style={{ flex: 1 }}><Text style={th.replyAuthor}>{reply.author_name}</Text><Text style={th.replyTime}>{timeAgo(reply.created_at)}</Text></View>
                {reply.comment_count > 0 && <View style={th.repliesHint}><MaterialIcons name="chat-bubble-outline" size={11} color="#7a9ab0" /><Text style={th.repliesHintTxt}>{reply.comment_count}</Text></View>}
                <MaterialIcons name="chevron-right" size={16} color="#3d5a70" style={{ marginLeft: 4 }} />
            </View>
            <Text style={th.replyContent}>{reply.content}</Text>
            <View style={th.voteBar}>
                <TouchableOpacity style={[th.voteBtn, voteState === 'up' && th.voteBtnUp]} onPress={e => { e.stopPropagation(); onVote(true); }}>
                    <MaterialIcons name="keyboard-arrow-up" size={17} color={voteState === 'up' ? '#34c78a' : '#3d5a70'} />
                    <Text style={[th.voteBtnTxt, voteState === 'up' && { color: '#34c78a' }]}>{reply.upvotes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[th.voteBtn, voteState === 'down' && th.voteBtnDown]} onPress={e => { e.stopPropagation(); onVote(false); }}>
                    <MaterialIcons name="keyboard-arrow-down" size={17} color={voteState === 'down' ? '#e05c5c' : '#3d5a70'} />
                    <Text style={[th.voteBtnTxt, voteState === 'down' && { color: '#e05c5c' }]}>{reply.downvotes}</Text>
                </TouchableOpacity>
                <Text style={[th.score, { color: score >= 0 ? '#34c78a' : '#e05c5c', marginLeft: 'auto' }]}>{score > 0 ? '+' : ''}{score}</Text>
            </View>
        </TouchableOpacity>
    );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, myRole, myUserID, voteState, onVote, onDeleteRequest, onPress }: {
    post: Post; myRole: string; myUserID: string; voteState: VoteState;
    onVote: (id: string, up: boolean) => void; onDeleteRequest: (id: string) => void; onPress: () => void;
}) {
    const canDelete = post.author_id === myUserID || myRole === 'owner' || myRole === 'moderator';
    const score = post.upvotes - post.downvotes;
    return (
        <TouchableOpacity style={s.postCard} onPress={onPress} activeOpacity={0.85}>
            <View style={s.postHeader}>
                <View style={s.postAuthorRow}>
                    <View style={s.postAvatar}><Text style={s.postAvatarText}>{post.author_name?.charAt(0).toUpperCase() ?? '?'}</Text></View>
                    <View><Text style={s.postAuthor}>{post.author_name}</Text><Text style={s.postTime}>{timeAgo(post.created_at)}</Text></View>
                </View>
                {canDelete && <TouchableOpacity onPress={e => { e.stopPropagation(); onDeleteRequest(post.id); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><MaterialIcons name="delete-outline" size={18} color="#3d5a70" /></TouchableOpacity>}
            </View>
            {post.title ? <Text style={s.postTitle}>{post.title}</Text> : null}
            <Text style={s.postContent} numberOfLines={4}>{post.content}</Text>
            {post.url ? <View style={s.postUrlRow}><MaterialIcons name="link" size={13} color="#00b4d8" /><Text style={s.postUrl} numberOfLines={1}>{post.url}</Text></View> : null}
            <View style={s.postFooter}>
                <TouchableOpacity style={[s.voteBtn, voteState === 'up' && s.voteBtnUp]} onPress={e => { e.stopPropagation(); onVote(post.id, true); }}>
                    <MaterialIcons name="keyboard-arrow-up" size={20} color={voteState === 'up' ? '#34c78a' : '#3d5a70'} />
                    <Text style={[s.voteBtnText, voteState === 'up' && { color: '#34c78a' }]}>{post.upvotes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.voteBtn, voteState === 'down' && s.voteBtnDown]} onPress={e => { e.stopPropagation(); onVote(post.id, false); }}>
                    <MaterialIcons name="keyboard-arrow-down" size={20} color={voteState === 'down' ? '#e05c5c' : '#3d5a70'} />
                    <Text style={[s.voteBtnText, voteState === 'down' && { color: '#e05c5c' }]}>{post.downvotes}</Text>
                </TouchableOpacity>
                <View style={s.commentBadge}><MaterialIcons name="chat-bubble-outline" size={14} color="#7a9ab0" /><Text style={s.commentBadgeText}>{post.comment_count}</Text></View>
                <Text style={[s.scoreText, { color: score >= 0 ? '#34c78a' : '#e05c5c', marginLeft: 'auto' }]}>{score > 0 ? '+' : ''}{score}</Text>
            </View>
        </TouchableOpacity>
    );
}

// ─── Create Post Modal ────────────────────────────────────────────────────────

function CreatePostModal({ visible, communityID, onClose, onCreated }: { visible: boolean; communityID: string; onClose: () => void; onCreated: () => void }) {
    const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({});
    const titleLeft = POST_TITLE_MAX - title.length; const contentLeft = POST_CONTENT_MAX - content.length;
    const reset = () => { setTitle(''); setContent(''); setUrl(''); setErrors({}); };
    const validate = () => {
        const e: Record<string, string> = {};
        if (!title.trim()) e.title = 'El título es obligatorio'; else if (title.length > POST_TITLE_MAX) e.title = `Máximo ${POST_TITLE_MAX} caracteres`;
        if (!content.trim()) e.content = 'El contenido es obligatorio'; else if (content.length > POST_CONTENT_MAX) e.content = `Máximo ${POST_CONTENT_MAX} caracteres`;
        setErrors(e); return Object.keys(e).length === 0;
    };
    const submit = async () => {
        if (!validate()) return; setLoading(true);
        try {
            const res = await authFetch(`${API_URL}/posts`, { method: 'POST', body: JSON.stringify({ community_id: communityID, title: title.trim(), content: content.trim(), url: url.trim() }) });
            if (res.ok) { reset(); onCreated(); onClose(); } else setErrors({ _global: await res.text() || 'Error al publicar' });
        } catch { setErrors({ _global: 'Sin conexión' }); } finally { setLoading(false); }
    };
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
            <View style={s.modalOverlay}><View style={s.modalSheet}>
                <View style={s.modalHandle} /><View style={s.modalHeader}><Text style={s.modalTitle}>Nuevo Post</Text><TouchableOpacity onPress={() => { reset(); onClose(); }}><MaterialIcons name="close" size={22} color="#7a9ab0" /></TouchableOpacity></View>
                <View style={s.fieldGroup}><View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Título <Text style={s.required}>*</Text></Text><Text style={[s.charCount, titleLeft < 8 && s.charWarn]}>{titleLeft}</Text></View><TextInput style={[s.modalInput, !!errors.title && s.inputError]} placeholder="¿Sobre qué trata? (máx. 32)" placeholderTextColor="#3d5a70" value={title} onChangeText={t => { setTitle(t); setErrors(e => ({ ...e, title: '' })); }} maxLength={POST_TITLE_MAX} />{errors.title ? <Text style={s.fieldError}>{errors.title}</Text> : null}</View>
                <View style={s.fieldGroup}><View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Contenido <Text style={s.required}>*</Text></Text><Text style={[s.charCount, contentLeft < 100 && s.charWarn]}>{contentLeft}</Text></View><TextInput style={[s.modalInput, s.modalTextarea, !!errors.content && s.inputError]} placeholder="¿Qué querés compartir?" placeholderTextColor="#3d5a70" value={content} onChangeText={t => { setContent(t); setErrors(e => ({ ...e, content: '' })); }} multiline numberOfLines={5} textAlignVertical="top" maxLength={POST_CONTENT_MAX} />{errors.content ? <Text style={s.fieldError}>{errors.content}</Text> : null}</View>
                <View style={s.fieldGroup}><Text style={s.fieldLabel}>Link (opcional)</Text><TextInput style={s.modalInput} placeholder="https://..." placeholderTextColor="#3d5a70" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" /></View>
                {errors._global ? <View style={s.globalError}><MaterialIcons name="error-outline" size={14} color="#e05c5c" /><Text style={s.globalErrorText}>{errors._global}</Text></View> : null}
                <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Publicar</Text>}</TouchableOpacity>
            </View></View>
        </Modal>
    );
}

function ManageRow({ icon, label, sub, onPress, danger }: { icon: any; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
    return (
        <TouchableOpacity style={s.manageRow} onPress={onPress} activeOpacity={0.7}>
            <View style={[s.manageIcon, { backgroundColor: danger ? 'rgba(224,92,92,0.1)' : 'rgba(0,180,216,0.1)' }]}><MaterialIcons name={icon} size={18} color={danger ? '#e05c5c' : '#00b4d8'} /></View>
            <View style={{ flex: 1 }}><Text style={[s.manageLabel, danger && { color: '#e05c5c' }]}>{label}</Text>{sub ? <Text style={s.manageSub}>{sub}</Text> : null}</View>
            <MaterialIcons name="chevron-right" size={18} color="#3d5a70" />
        </TouchableOpacity>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id: string; name: string; description: string; rules: string; topics: string; is_private: string; member_count: string; post_count: string }>();

    const [communityInfo, setCommunityInfo] = useState({
        id: params.id, name: params.name, description: params.description ?? '', rules: params.rules ?? '',
        topics: (() => { try { return JSON.parse(params.topics ?? '[]'); } catch { return []; } })(),
        is_private: params.is_private === '1',
        member_count: parseInt(params.member_count ?? '0', 10),
        post_count: parseInt(params.post_count ?? '0', 10),
    });

    const [activeTab, setActiveTab] = useState<DetailTab>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [myRole, setMyRole] = useState('');
    const [myUserID, setMyUserID] = useState('');
    const [isMember, setIsMember] = useState(false);
    const [joining, setJoining] = useState(false);
    const [requestSent, setRequestSent] = useState(false);
    const [memberCount, setMemberCount] = useState(communityInfo.member_count);
    const [votes, setVotes] = useState<Record<string, VoteState>>({});
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [postQuery, setPostQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showPostDetail, setShowPostDetail] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [showRequests, setShowRequests] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const { state: dlg, show: showDlg, hide: hideDlg } = useConfirm();

    // Cargar userID del token al montar
    React.useEffect(() => { getMyUserID().then(setMyUserID); }, []);

    const loadRole = useCallback(async () => {
        try {
            const res = await authFetch(`${API_URL}/communities/${communityInfo.id}/role`);
            if (res.ok) { const d = await res.json(); setMyRole(d.role ?? ''); setIsMember(true); }
            else { setIsMember(false); setMyRole(''); }
        } catch { }
    }, [communityInfo.id]);

    const loadPosts = useCallback(async () => {
        setLoadingPosts(true);
        try {
            const res = await authFetch(`${API_URL}/communities/${communityInfo.id}/posts`);
            if (res.ok) {
                const data: Post[] = await res.json() ?? [];
                setPosts(data);
                const initial: Record<string, VoteState> = {};
                data.forEach(p => { if (p.user_vote === true) initial[p.id] = 'up'; else if (p.user_vote === false) initial[p.id] = 'down'; });
                setVotes(initial);
            }
        } catch { } finally { setLoadingPosts(false); }
    }, [communityInfo.id]);

    React.useEffect(() => { loadRole(); loadPosts(); }, []);
    const onRefresh = async () => { setRefreshing(true); await Promise.all([loadRole(), loadPosts()]); setRefreshing(false); };

    const handleJoin = async () => {
        setJoining(true);
        try {
            const res = await authFetch(`${API_URL}/communities/${communityInfo.id}/join`, { method: 'POST' });
            if (res.ok) { if (communityInfo.is_private) setRequestSent(true); else { setIsMember(true); setMyRole('member'); setMemberCount(c => c + 1); loadPosts(); } }
            else showDlg({ title: 'Error', message: await res.text(), confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg });
        } catch { showDlg({ title: 'Error', message: 'Sin conexión', confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg }); }
        finally { setJoining(false); }
    };

    const handleLeave = () => {
        showDlg({
            title: 'Abandonar comunidad', message: '¿Estás seguro? Perderás acceso si la comunidad es privada.',
            confirmLabel: 'Abandonar', danger: true, onCancel: hideDlg,
            onConfirm: async () => {
                hideDlg();
                try {
                    const res = await authFetch(`${API_URL}/communities/${communityInfo.id}/leave`, { method: 'POST' });
                    if (res.ok) { setIsMember(false); setMyRole(''); setMemberCount(c => Math.max(0, c - 1)); router.back(); }
                    else showDlg({ title: 'Error', message: await res.text(), confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg });
                } catch { showDlg({ title: 'Error', message: 'Sin conexión', confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg }); }
            },
        });
    };

    const handleDeleteCommunity = () => {
        showDlg({
            title: 'Eliminar comunidad', message: '¿Estás seguro? Se eliminarán todos los posts y miembros.',
            confirmLabel: 'Eliminar', danger: true, onCancel: hideDlg,
            onConfirm: async () => {
                hideDlg();
                try {
                    const res = await authFetch(`${API_URL}/communities/${communityInfo.id}`, { method: 'DELETE' });
                    if (res.ok) router.replace('/home?tab=community');
                    else showDlg({ title: 'Error', message: await res.text(), confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg });
                } catch { showDlg({ title: 'Error', message: 'Sin conexión', confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg }); }
            },
        });
    };

    const handleVote = async (postID: string, isUpvote: boolean) => {
        const current = votes[postID] ?? null;
        const newVote: VoteState = current === (isUpvote ? 'up' : 'down') ? null : (isUpvote ? 'up' : 'down');
        setVotes(v => ({ ...v, [postID]: newVote }));
        setPosts(prev => prev.map(p => {
            if (p.id !== postID) return p;
            let { upvotes, downvotes } = p;
            if (current === 'up') upvotes = Math.max(0, upvotes - 1); if (current === 'down') downvotes = Math.max(0, downvotes - 1);
            if (newVote === 'up') upvotes++; if (newVote === 'down') downvotes++;
            return { ...p, upvotes, downvotes };
        }));
        if (newVote !== null) {
            try { await authFetch(`${API_URL}/posts/${postID}/vote`, { method: 'POST', body: JSON.stringify({ is_upvote: isUpvote }) }); }
            catch { setVotes(v => ({ ...v, [postID]: current })); }
        }
    };

    const handleDeletePost = (postID: string) => {
        showDlg({
            title: 'Borrar post', message: '¿Confirmar eliminación?',
            confirmLabel: 'Borrar', danger: true, onCancel: hideDlg,
            onConfirm: async () => {
                hideDlg();
                try {
                    const res = await authFetch(`${API_URL}/posts/${postID}`, { method: 'DELETE' });
                    if (res.ok) setPosts(prev => prev.filter(p => p.id !== postID));
                    else showDlg({ title: 'Error', message: await res.text(), confirmLabel: 'OK', onConfirm: hideDlg, onCancel: hideDlg });
                } catch { }
            },
        });
    };

    const searchPosts = async () => {
        if (!postQuery.trim()) { loadPosts(); return; }
        setSearching(true);
        try {
            const res = await authFetch(`${API_URL}/communities/${communityInfo.id}/posts/search?q=${encodeURIComponent(postQuery)}`);
            if (res.ok) setPosts(await res.json() ?? []);
        } catch { } finally { setSearching(false); }
    };

    const canManage = myRole === 'owner' || myRole === 'moderator';
    const visibleTabs: { id: DetailTab; label: string; icon: any }[] = [
        { id: 'posts', label: 'Posts', icon: 'article' },
        { id: 'about', label: 'Acerca de', icon: 'info-outline' },
        ...(canManage ? [{ id: 'manage' as DetailTab, label: 'Gestión', icon: 'admin-panel-settings' }] : []),
    ];

    return (
        <SafeAreaView style={s.root}>
            {/* Header con back + home */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="arrow-back" size={24} color="#e8f4f8" />
                </TouchableOpacity>
                <Text style={s.headerTitle} numberOfLines={1}>{communityInfo.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {/* Botón home → tab comunidad */}
                    <TouchableOpacity onPress={() => router.replace('/home?tab=community')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialIcons name="home" size={24} color="#3d5a70" />
                    </TouchableOpacity>
                    {/* Abandonar (solo si es miembro y no owner) */}
                    {isMember && myRole !== 'owner' && (
                        <TouchableOpacity onPress={handleLeave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <MaterialIcons name="exit-to-app" size={22} color="#e05c5c" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={s.banner}>
                <View style={s.bannerAvatar}><Text style={s.bannerAvatarText}>{communityInfo.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={s.bannerName}>{communityInfo.name}</Text>
                        {communityInfo.is_private && <MaterialIcons name="lock" size={14} color="#e05c5c" />}
                        {myRole ? <RoleBadge role={myRole} /> : null}
                    </View>
                    <View style={s.bannerStats}>
                        <MaterialIcons name="people" size={13} color="#00b4d8" />
                        <Text style={s.bannerStat}>{memberCount.toLocaleString()} miembros</Text>
                        <Text style={s.dot}>·</Text>
                        <MaterialIcons name="article" size={13} color="#7a9ab0" />
                        <Text style={s.bannerStat}>{communityInfo.post_count} posts</Text>
                    </View>
                </View>
                {!isMember && !requestSent && (
                    <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={joining}>
                        {joining ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.joinBtnText}>{communityInfo.is_private ? 'Solicitar' : 'Unirse'}</Text>}
                    </TouchableOpacity>
                )}
                {requestSent && <View style={[s.joinBtn, { backgroundColor: '#1a2d42' }]}><Text style={[s.joinBtnText, { color: '#7a9ab0' }]}>Pendiente</Text></View>}
            </View>

            <View style={s.tabBar}>
                {visibleTabs.map(t => (
                    <TouchableOpacity key={t.id} style={[s.tabBtn, activeTab === t.id && s.tabBtnActive]} onPress={() => setActiveTab(t.id)}>
                        <MaterialIcons name={t.icon} size={15} color={activeTab === t.id ? '#00b4d8' : '#3d5a70'} />
                        <Text style={[s.tabBtnText, activeTab === t.id && s.tabBtnTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeTab === 'posts' && (
                <View style={{ flex: 1 }}>
                    <View style={s.postSearch}>
                        <MaterialIcons name="search" size={16} color="#3d5a70" />
                        <TextInput style={s.postSearchInput} placeholder="Buscar en esta comunidad..." placeholderTextColor="#3d5a70" value={postQuery} onChangeText={setPostQuery} onSubmitEditing={searchPosts} returnKeyType="search" />
                        {postQuery.length > 0 && <TouchableOpacity onPress={() => { setPostQuery(''); loadPosts(); }}><MaterialIcons name="close" size={15} color="#3d5a70" /></TouchableOpacity>}
                    </View>
                    {loadingPosts || searching ? <ActivityIndicator color="#00b4d8" style={{ marginTop: 40 }} /> : (
                        <FlatList data={posts} keyExtractor={p => p.id}
                                  renderItem={({ item }) => <PostCard post={item} myRole={myRole} myUserID={myUserID} voteState={votes[item.id] ?? null} onVote={handleVote} onDeleteRequest={handleDeletePost} onPress={() => { setSelectedPost(item); setShowPostDetail(true); }} />}
                                  contentContainerStyle={s.postList}
                                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00b4d8" />}
                                  ListEmptyComponent={<View style={s.emptyBox}><MaterialIcons name="article" size={48} color="#1e3a5a" /><Text style={s.emptyTitle}>{!isMember ? 'Unite para ver los posts' : 'Todavía no hay posts'}</Text>{isMember && <Text style={s.emptyText}>¡Sé el primero en publicar!</Text>}</View>}
                        />
                    )}
                    {isMember && <TouchableOpacity style={s.fab} onPress={() => setShowCreatePost(true)}><MaterialIcons name="edit" size={22} color="#fff" /></TouchableOpacity>}
                </View>
            )}

            {activeTab === 'about' && (
                <ScrollView contentContainerStyle={s.aboutContent}>
                    <View style={s.aboutCard}><View style={s.aboutCardHeader}><MaterialIcons name="info-outline" size={16} color="#00b4d8" /><Text style={s.aboutCardTitle}>Descripción</Text></View><Text style={s.aboutText}>{communityInfo.description || 'Sin descripción.'}</Text></View>
                    <View style={s.aboutCard}><View style={s.aboutCardHeader}><MaterialIcons name="gavel" size={16} color="#00b4d8" /><Text style={s.aboutCardTitle}>Reglas</Text></View><Text style={s.aboutText}>{communityInfo.rules || 'No hay reglas definidas.'}</Text></View>
                    {communityInfo.topics?.length > 0 && <View style={s.aboutCard}><View style={s.aboutCardHeader}><MaterialIcons name="label-outline" size={16} color="#00b4d8" /><Text style={s.aboutCardTitle}>Temas</Text></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{communityInfo.topics.map((t: string) => <TopicPill key={t} topic={t} />)}</View></View>}
                    <View style={s.aboutCard}>
                        <View style={s.aboutCardHeader}><MaterialIcons name="bar-chart" size={16} color="#00b4d8" /><Text style={s.aboutCardTitle}>Estadísticas</Text></View>
                        <View style={s.statGrid}>
                            <View style={s.statItem}><Text style={s.statValue}>{memberCount.toLocaleString()}</Text><Text style={s.statLabel}>Miembros</Text></View>
                            <View style={s.statDivider} />
                            <View style={s.statItem}><Text style={s.statValue}>{communityInfo.post_count}</Text><Text style={s.statLabel}>Posts</Text></View>
                            <View style={s.statDivider} />
                            <View style={s.statItem}><MaterialIcons name={communityInfo.is_private ? 'lock' : 'lock-open'} size={20} color={communityInfo.is_private ? '#e05c5c' : '#34c78a'} /><Text style={s.statLabel}>{communityInfo.is_private ? 'Privada' : 'Pública'}</Text></View>
                        </View>
                    </View>
                </ScrollView>
            )}

            {activeTab === 'manage' && canManage && (
                <ScrollView contentContainerStyle={s.aboutContent}>
                    {communityInfo.is_private && (
                        <View style={s.aboutCard}>
                            <Text style={s.aboutCardTitle}>Solicitudes</Text>
                            <ManageRow icon="pending-actions" label="Ver solicitudes pendientes" sub="Aprobar o rechazar nuevos miembros" onPress={() => setShowRequests(true)} />
                        </View>
                    )}
                    <View style={s.aboutCard}>
                        <Text style={s.aboutCardTitle}>Miembros</Text>
                        <ManageRow icon="manage-accounts" label="Gestionar miembros" sub="Ver, expulsar o cambiar roles" onPress={() => setShowMembers(true)} />
                    </View>
                    {myRole === 'owner' && (
                        <View style={s.aboutCard}>
                            <Text style={s.aboutCardTitle}>Comunidad</Text>
                            <ManageRow icon="edit" label="Editar comunidad" sub="Nombre, descripción y reglas" onPress={() => setShowEdit(true)} />
                            <ManageRow icon="delete-forever" label="Eliminar comunidad" sub="Acción irreversible" danger onPress={handleDeleteCommunity} />
                        </View>
                    )}
                </ScrollView>
            )}

            <CreatePostModal visible={showCreatePost} communityID={communityInfo.id} onClose={() => setShowCreatePost(false)} onCreated={loadPosts} />
            <ThreadModal visible={showPostDetail} rootPost={selectedPost} isMember={isMember} onClose={() => { setShowPostDetail(false); setSelectedPost(null); loadPosts(); }} />
            <MembersModal visible={showMembers} communityID={communityInfo.id} myRole={myRole} myUserID={myUserID} onClose={() => setShowMembers(false)} />
            <RequestsModal visible={showRequests} communityID={communityInfo.id} onClose={() => setShowRequests(false)} />
            <EditCommunityModal visible={showEdit} community={communityInfo} onClose={() => setShowEdit(false)} onSaved={(updated) => setCommunityInfo(prev => ({ ...prev, ...updated }))} />
            <ConfirmDialog {...dlg} />
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mg = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { flex: 1, backgroundColor: '#080f1a', marginTop: 48 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0d1826', borderBottomWidth: 1, borderBottomColor: '#1a2d42' },
    headerTitle: { color: '#e8f4f8', fontWeight: '700', fontSize: 16 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(224,92,92,0.1)', margin: 14, borderRadius: 10, padding: 10 },
    errorText: { color: '#e05c5c', fontSize: 13, flex: 1 },
    memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111e2e', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1a2d42', gap: 12 },
    memberAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0a2030', alignItems: 'center', justifyContent: 'center' },
    memberAvatarTxt: { color: '#00b4d8', fontWeight: '700', fontSize: 16 },
    memberName: { color: '#e8f4f8', fontWeight: '600', fontSize: 14 },
    memberSince: { color: '#3d5a70', fontSize: 11, marginTop: 2 },
    actionBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#0d1826', borderWidth: 1, borderColor: '#1a2d42', alignItems: 'center', justifyContent: 'center' },
});

const th = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { flex: 1, backgroundColor: '#080f1a', marginTop: 48 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0d1826', borderBottomWidth: 1, borderBottomColor: '#1a2d42' },
    headerTitle: { color: '#e8f4f8', fontWeight: '700', fontSize: 15 },
    headerSub: { color: '#3d5a70', fontSize: 11, marginTop: 1 },
    depthBadge: { backgroundColor: '#132238', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#1a2d42' },
    depthText: { color: '#7a9ab0', fontSize: 10, fontWeight: '700' },
    scroll: { padding: 14 },
    postBox: { backgroundColor: '#111e2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a2d42', marginBottom: 16 },
    dividerRow: { paddingVertical: 8, paddingHorizontal: 4, marginBottom: 6 },
    dividerText: { color: '#3d5a70', fontSize: 13, fontWeight: '600' },
    emptyBox: { alignItems: 'center', paddingTop: 40, gap: 10 },
    emptyText: { color: '#3d5a70', fontSize: 14 },
    replyCard: { backgroundColor: '#111e2e', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1a2d42', gap: 8 },
    replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    replyAvatar: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#0a2030', alignItems: 'center', justifyContent: 'center' },
    replyAvatarTxt: { color: '#00b4d8', fontWeight: '700', fontSize: 12 },
    replyAuthor: { color: '#e8f4f8', fontWeight: '600', fontSize: 13 },
    replyTime: { color: '#3d5a70', fontSize: 11 },
    replyContent: { color: '#7a9ab0', fontSize: 14, lineHeight: 20 },
    repliesHint: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#0d1826', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    repliesHintTxt: { color: '#7a9ab0', fontSize: 10 },
    voteBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: '#0d1826', borderWidth: 1, borderColor: '#1a2d42' },
    voteBtnUp: { borderColor: '#34c78a', backgroundColor: 'rgba(52,199,138,0.08)' },
    voteBtnDown: { borderColor: '#e05c5c', backgroundColor: 'rgba(224,92,92,0.08)' },
    voteBtnTxt: { color: '#3d5a70', fontSize: 12, fontWeight: '600' },
    score: { fontWeight: '700', fontSize: 12 },
    inputArea: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d1826', borderTopWidth: 1, borderTopColor: '#1a2d42', padding: 12, gap: 6 },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    errorText: { color: '#e05c5c', fontSize: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: { flex: 1, backgroundColor: '#111e2e', borderRadius: 12, borderWidth: 1, borderColor: '#1a2d42', paddingHorizontal: 14, paddingVertical: 10, color: '#e8f4f8', fontSize: 14, maxHeight: 100 },
    inputRight: { gap: 4, alignItems: 'center' },
    charCount: { color: '#3d5a70', fontSize: 11 },
    sendBtn: { backgroundColor: '#00b4d8', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sendDisabled: { backgroundColor: '#1a2d42' },
});

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#080f1a', paddingTop: Platform.OS === 'android' ? 32 : 0 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0d1826', borderBottomWidth: 1, borderBottomColor: '#1a2d42', gap: 12 },
    headerTitle: { flex: 1, color: '#e8f4f8', fontSize: 17, fontWeight: '700' },
    banner: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#0d1826', borderBottomWidth: 1, borderBottomColor: '#1a2d42', gap: 14 },
    bannerAvatar: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#0a2a40', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1a2d42' },
    bannerAvatarText: { color: '#00b4d8', fontSize: 26, fontWeight: '700' },
    bannerName: { color: '#e8f4f8', fontWeight: '700', fontSize: 17 },
    bannerStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
    bannerStat: { color: '#7a9ab0', fontSize: 12 },
    dot: { color: '#3d5a70' },
    joinBtn: { backgroundColor: '#00b4d8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, minWidth: 82, alignItems: 'center' },
    joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    tabBar: { flexDirection: 'row', backgroundColor: '#0d1826', borderBottomWidth: 1, borderBottomColor: '#1a2d42' },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: '#00b4d8' },
    tabBtnText: { color: '#3d5a70', fontWeight: '600', fontSize: 13 },
    tabBtnTextActive: { color: '#e8f4f8' },
    postSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0d1826', borderBottomWidth: 1, borderBottomColor: '#1a2d42', paddingHorizontal: 16, paddingVertical: 8 },
    postSearchInput: { flex: 1, color: '#e8f4f8', fontSize: 14, height: 36 },
    postList: { padding: 12, paddingBottom: 100, gap: 10 },
    postCard: { backgroundColor: '#111e2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1a2d42' },
    postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    postAvatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#0a2030', alignItems: 'center', justifyContent: 'center' },
    postAvatarText: { color: '#00b4d8', fontWeight: '700', fontSize: 14 },
    postAuthor: { color: '#e8f4f8', fontWeight: '600', fontSize: 14 },
    postTime: { color: '#3d5a70', fontSize: 11 },
    postTitle: { color: '#e8f4f8', fontWeight: '700', fontSize: 16, marginBottom: 6 },
    postContent: { color: '#7a9ab0', fontSize: 14, lineHeight: 20 },
    postUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    postUrl: { color: '#00b4d8', fontSize: 12, flex: 1 },
    postFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6, borderTopWidth: 1, borderTopColor: '#1a2d42', paddingTop: 10 },
    voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#0d1826', borderWidth: 1, borderColor: '#1a2d42' },
    voteBtnUp: { borderColor: '#34c78a', backgroundColor: 'rgba(52,199,138,0.08)' },
    voteBtnDown: { borderColor: '#e05c5c', backgroundColor: 'rgba(224,92,92,0.08)' },
    voteBtnText: { color: '#3d5a70', fontSize: 13, fontWeight: '600' },
    commentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
    commentBadgeText: { color: '#7a9ab0', fontSize: 13 },
    scoreText: { fontWeight: '700', fontSize: 13 },
    emptyBox: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 40 },
    emptyTitle: { color: '#4a6a80', fontSize: 16, fontWeight: '700' },
    emptyText: { color: '#3d5a70', textAlign: 'center', fontSize: 14 },
    fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#00b4d8', width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', shadowColor: '#00b4d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
    aboutContent: { padding: 14, gap: 12, paddingBottom: 40 },
    aboutCard: { backgroundColor: '#111e2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1a2d42', gap: 4 },
    aboutCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    aboutCardTitle: { color: '#e8f4f8', fontWeight: '700', fontSize: 14, marginBottom: 4 },
    aboutText: { color: '#7a9ab0', fontSize: 14, lineHeight: 22 },
    statGrid: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: { color: '#00b4d8', fontWeight: '700', fontSize: 22 },
    statLabel: { color: '#7a9ab0', fontSize: 12 },
    statDivider: { width: 1, height: 40, backgroundColor: '#1a2d42' },
    manageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1a2d42' },
    manageIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    manageLabel: { color: '#e8f4f8', fontSize: 14, fontWeight: '600' },
    manageSub: { color: '#7a9ab0', fontSize: 12, marginTop: 2 },
    roleBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    roleBadgeText: { fontSize: 10, fontWeight: '700' },
    topicPill: { backgroundColor: '#0a2030', borderRadius: 8, borderWidth: 1, borderColor: '#1a2d42', paddingHorizontal: 8, paddingVertical: 3 },
    topicPillText: { color: '#7a9ab0', fontSize: 11, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#0d1826', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 10, borderTopWidth: 1, borderTopColor: '#1a2d42' },
    modalHandle: { width: 40, height: 4, backgroundColor: '#1a2d42', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    modalTitle: { color: '#e8f4f8', fontSize: 18, fontWeight: '700' },
    fieldGroup: { gap: 5 },
    fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { color: '#3d5a70', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    required: { color: '#e05c5c' },
    charCount: { color: '#3d5a70', fontSize: 11 },
    charWarn: { color: '#f5a623' },
    fieldError: { color: '#e05c5c', fontSize: 12 },
    inputError: { borderColor: '#e05c5c' },
    globalError: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(224,92,92,0.1)', borderRadius: 8, padding: 10 },
    globalErrorText: { color: '#e05c5c', fontSize: 13, flex: 1 },
    modalInput: { backgroundColor: '#111e2e', borderRadius: 12, borderWidth: 1, borderColor: '#1a2d42', paddingHorizontal: 14, paddingVertical: 12, color: '#e8f4f8', fontSize: 15 },
    modalTextarea: { height: 110, paddingTop: 12 },
    primaryBtn: { backgroundColor: '#00b4d8', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});