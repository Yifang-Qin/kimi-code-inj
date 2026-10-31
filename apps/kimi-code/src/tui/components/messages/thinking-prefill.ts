/**
 * Renders the locally injected `/inj` thinking prefix as `[prefill] <prefix>`
 * in the accent color, so it reads apart from the model's own (dim italic)
 * thinking. Static: it has no live/spinner state, so a step that streams no
 * thinking cannot leave it spinning.
 */

import { Text, type Component } from '@moonshot-ai/pi-tui';

import { MESSAGE_INDENT } from '#/tui/constant/rendering';
import { STATUS_BULLET } from '#/tui/constant/symbols';
import { currentTheme } from '#/tui/theme';

export class ThinkingPrefillComponent implements Component {
  private readonly textComponent: Text;

  constructor(private readonly prefix: string) {
    this.textComponent = new Text(this.styled(), 0, 0);
  }

  private styled(): string {
    return currentTheme.fg('accent', `[prefill] ${this.prefix}`);
  }

  invalidate(): void {
    this.textComponent.setText(this.styled());
  }

  render(width: number): string[] {
    const contentWidth = Math.max(1, width - MESSAGE_INDENT.length);
    const contentLines = this.textComponent.render(contentWidth);
    return [
      '',
      ...contentLines.map(
        (line, index) => (index === 0 ? currentTheme.fg('accent', STATUS_BULLET) : MESSAGE_INDENT) + line,
      ),
    ];
  }
}
