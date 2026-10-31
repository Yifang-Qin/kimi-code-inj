import { visibleWidth, type TUI } from '@moonshot-ai/pi-tui';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  InjPrefixEditorComponent,
  type InjPrefixEditorResult,
} from '#/tui/components/dialogs/inj-prefix-editor';

const ESC = String.fromCodePoint(27);
const CTRL_C = String.fromCodePoint(3);
const ENTER = '\r';
const SHIFT_ENTER = `${ESC}[13;2~`;
const ANSI_RE = new RegExp(`${ESC}\\[[0-9;]*m|${ESC}_[^${ESC}]*${ESC}\\\\`, 'g');

function strip(text: string): string {
  return text.replaceAll(ANSI_RE, '');
}

function makeDialog(initialText = ''): {
  dialog: InjPrefixEditorComponent;
  collected: InjPrefixEditorResult[];
} {
  const tui = {
    requestRender: vi.fn(),
    terminal: { rows: 40, cols: 120 },
  } as unknown as TUI;
  const collected: InjPrefixEditorResult[] = [];
  const dialog = new InjPrefixEditorComponent(tui, initialText, (result) => {
    collected.push(result);
  });
  dialog.focused = true;
  return { dialog, collected };
}

function type(dialog: InjPrefixEditorComponent, text: string): void {
  for (const ch of text) dialog.handleInput(ch);
}

describe('InjPrefixEditorComponent', () => {
  it('renders the title, hint and the prefilled text', () => {
    const { dialog } = makeDialog('first line\nsecond line');
    const text = strip(dialog.render(60).join('\n'));

    expect(text).toContain('Edit /inj thinking prefix');
    expect(text).toContain('Enter save · Shift+Enter newline · Esc cancel');
    expect(text).toContain('first line');
    expect(text).toContain('second line');
  });

  it('keeps every line within narrow widths', () => {
    const { dialog } = makeDialog('a long prefix that has to wrap inside a narrow terminal');
    for (const line of dialog.render(20)) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it('saves the edited multi-line text on Enter, Shift+Enter inserts a newline', () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { dialog, collected } = makeDialog('plan');
    type(dialog, ' first');
    dialog.handleInput(SHIFT_ENTER);
    type(dialog, 'then act');
    expect(collected).toEqual([]);

    vi.advanceTimersByTime(1000);
    dialog.handleInput(ENTER);
    expect(collected).toEqual([{ kind: 'ok', value: 'plan first\nthen act' }]);
  });

  it('refuses an empty prefix and shows the empty hint', () => {
    const { dialog, collected } = makeDialog('   ');
    dialog.handleInput(ENTER);

    expect(collected).toEqual([]);
    expect(strip(dialog.render(60).join('\n'))).toContain('Prefix cannot be empty');
  });

  it.each([
    ['Esc', ESC],
    ['Ctrl+C', CTRL_C],
  ])('cancels on %s', (_label, key) => {
    const { dialog, collected } = makeDialog('keep me');
    dialog.handleInput(key);
    dialog.handleInput(ENTER);

    expect(collected).toEqual([{ kind: 'cancel' }]);
  });
});
