import { berlinParts } from './berlin';

export interface Msg {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ChatItem {
  msg: Msg;
  mine: boolean;
  /** Data e Berlinit (YYYY-MM-DD) kur kjo është mesazhi i parë i ditës: shfaq ndarësin e ditës. */
  dayHeader: string | null;
  /** Në grup: shfaq emrin e dërguesit mbi këtë mesazh (fillim i një serie nga i njëjti person). */
  showName: boolean;
  /** Mesazhi tjetër (më i vjetri) është nga i njëjti person: bashkoje vizualisht. */
  continued: boolean;
}

/**
 * Përgatit listën për shfaqje. `messages` janë më të rejat të parat (siç i kthen databaza dhe siç e do lista e kthyer).
 * Mesazhi `i + 1` është ai që është dërguar para tij.
 */
export function buildChatItems(messages: Msg[], meId: string, isGroup: boolean): ChatItem[] {
  return messages.map((msg, i) => {
    const older = messages[i + 1];
    const day = berlinParts(msg.created_at).date;
    const olderDay = older ? berlinParts(older.created_at).date : null;
    const dayHeader = day !== olderDay ? day : null;
    const sameSenderAsOlder = !!older && older.sender_id === msg.sender_id && !dayHeader;
    return {
      msg,
      mine: msg.sender_id === meId,
      dayHeader,
      showName: isGroup && msg.sender_id !== meId && !sameSenderAsOlder,
      continued: sameSenderAsOlder,
    };
  });
}

/** "14:32" për sot, "26.10." për ditët e tjera (sipas orës së Berlinit). */
export function chatTimeLabel(iso: string, nowIso: string, hhmm: (iso: string) => string): string {
  const d = berlinParts(iso).date;
  if (d === berlinParts(nowIso).date) return hhmm(iso);
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
}
