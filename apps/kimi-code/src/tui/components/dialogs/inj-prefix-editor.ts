/**
 * InjPrefixEditorComponent — multi-line editor for the `/inj` custom
 * thinking prefix. Wraps a pi-tui Editor (Enter saves, Shift+Enter inserts
 * a newline) prefilled with the saved text, mounted in the editor slot.
 */

import {
  Container,
  Editor,
  Key,
  matchesKey,
  truncateToWidth,
  type Focusable,
  type TUI,
} from '@moonshot-ai/pi-tui';

import { currentTheme } from '#/tui/theme';
import { createEditorTheme } from '#/tui/theme/pi-tui-theme';

export type InjPrefixEditorResult =
  | { readonly kind: 'ok'; readonly value: string }
  | { readonly kind: 'cancel' };

const TITLE = 'Edit /inj thinking prefix';
const HINT = 'Enter save · Shift+Enter newline · Esc cancel';
const HINT_EMPTY = 'Prefix cannot be empty · Esc cancel';

export class InjPrefixEditorComponent extends Container implements Focusable {
  focused = false;

  private readonly editor: Editor;
  private readonly onDone: (result: InjPrefixEditorResult) => void;
  private done = false;
  private emptyHinted = false;

  constructor(tui: TUI, initialText: string, onDone: (result: InjPrefixEditorResult) => void) {
    super();
    this.onDone = onDone;
    this.editor = new Editor(tui, createEditorTheme(), { paddingX: 1 });
    this.editor.borderColor = (s) => currentTheme.fg('primary', s);
    this.editor.setText(initialText);
    this.editor.onSubmit = (value) => {
      this.submit(value);
    };
  }

  handleInput(data: string): void {
    if (this.done) return;
    if (
      matchesKey(data, Key.escape) ||
      matchesKey(data, Key.ctrl('c')) ||
      matchesKey(data, Key.ctrl('d'))
    ) {
      this.done = true;
      this.onDone({ kind: 'cancel' });
      return;
    }
    this.emptyHinted = false;
    this.editor.handleInput(data);
  }

  override invalidate(): void {
    super.invalidate();
    this.editor.invalidate();
  }

  override render(width: number): string[] {
    this.editor.focused = this.focused && !this.done;
    const hint = this.emptyHinted
      ? currentTheme.fg('error', ` ${HINT_EMPTY}`)
      : currentTheme.fg('textMuted', ` ${HINT}`);
    return [
      truncateToWidth(currentTheme.boldFg('primary', ` ${TITLE}`), width, '…'),
      truncateToWidth(hint, width, '…'),
      ...this.editor.render(width),
    ];
  }

  private submit(value: string): void {
    if (this.done) return;
    if (value.length === 0) {
      this.emptyHinted = true;
      return;
    }
    this.done = true;
    this.onDone({ kind: 'ok', value });
  }
}
