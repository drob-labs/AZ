import { describe, expect, it } from 'vitest';
import { buildChatItems, chatTimeLabel } from './chatList';

const m = (id: string, sender: string, iso: string) => ({ id, sender_id: sender, body: id, created_at: iso });

describe('buildChatItems', () => {
  // më të rejat të parat
  const list = [
    m('4', 'ana', '2026-10-27T10:05:00Z'),
    m('3', 'ana', '2026-10-27T10:04:00Z'),
    m('2', 'beni', '2026-10-27T10:00:00Z'),
    m('1', 'ana', '2026-10-26T09:00:00Z'),
  ];

  it('shënon mesazhet e mia', () => {
    const items = buildChatItems(list, 'beni', true);
    expect(items.map((i) => i.mine)).toEqual([false, false, true, false]);
  });

  it('në grup shfaq emrin vetëm në fillim të serisë së një personi, jo për mesazhet e mia', () => {
    const items = buildChatItems(list, 'beni', true);
    // 4 vazhdon nga 3 (e njëjta Ana), 3 fillon serinë pas mesazhit të Benit, 2 është i imi, 1 fillon ditën
    expect(items.map((i) => i.showName)).toEqual([false, true, false, true]);
    expect(items[0].continued).toBe(true);
  });

  it('në bisedë private nuk shfaq emra', () => {
    expect(buildChatItems(list, 'beni', false).some((i) => i.showName)).toBe(false);
  });

  it('vë ndarës dite vetëm te mesazhi i parë i çdo dite', () => {
    const items = buildChatItems(list, 'beni', true);
    expect(items.map((i) => i.dayHeader)).toEqual([null, null, '2026-10-27', '2026-10-26']);
  });
});

describe('chatTimeLabel', () => {
  const hhmm = () => '12:00';
  it('sot: ora; ditë tjetër: data', () => {
    expect(chatTimeLabel('2026-10-27T10:00:00Z', '2026-10-27T18:00:00Z', hhmm)).toBe('12:00');
    expect(chatTimeLabel('2026-10-26T10:00:00Z', '2026-10-27T18:00:00Z', hhmm)).toBe('26.10.');
  });
});
