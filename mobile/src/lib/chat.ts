import { supabase } from './supabase';

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface RoomOverview {
  room_id: string;
  kind: 'site' | 'dm';
  site_id: string | null;
  site_name: string | null;
  site_photo: string | null;
  other_id: string | null;
  last_body: string | null;
  last_at: string | null;
  last_sender: string | null;
  unread: number;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  avatar_path: string | null;
  role: 'worker' | 'admin';
  active: boolean;
}

export const PAGE_SIZE = 40;
export const MAX_LENGTH = 2000;

export async function fetchOverview(): Promise<RoomOverview[]> {
  const { data, error } = await supabase.rpc('chat_overview');
  if (error) throw error;
  return (data ?? []) as RoomOverview[];
}

export async function fetchDirectory(): Promise<Person[]> {
  const { data, error } = await supabase.rpc('chat_directory');
  if (error) throw error;
  return (data ?? []) as Person[];
}

/** Mesazhet e dhomës, më të rejat të parat. `before` = koha e mesazhit më të vjetër që e kemi tashmë. */
export async function fetchMessages(roomId: string, before?: string): Promise<ChatMessage[]> {
  let q = supabase
    .from('chat_messages')
    .select('id, room_id, sender_id, body, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(roomId: string, senderId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, sender_id: senderId, body: body.trim() })
    .select('id, room_id, sender_id, body, created_at')
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function openDm(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_dm', { p_other: otherId });
  if (error || !data) throw error ?? new Error('open_dm');
  return data as string;
}

export async function fetchBlocked(): Promise<string[]> {
  const { data, error } = await supabase.from('chat_blocks').select('blocked_id');
  if (error) throw error;
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export async function blockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase.from('chat_blocks').upsert({ blocker_id: myId, blocked_id: otherId });
  if (error) throw error;
}

export async function reportMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('report_message', { p_message: messageId, p_reason: null });
  if (error) throw error;
}

export async function markRead(roomId: string): Promise<void> {
  await supabase.rpc('chat_mark_read', { p_room: roomId });
}
