import { ChoicePickerComponent } from '../components/dialogs/choice-picker';
import { DEFAULT_INJ_CONFIG, saveTuiConfig, type InjConfig } from '../config';
import { DEFAULT_THINKING_PREFILL, resolveThinkingPrefill } from '../constant/inj';
import { formatErrorMessage } from '../utils/event-payload';
import { currentTuiConfig } from './config';
import type { SlashCommandHost } from './dispatch';

const INJ_SETUP_USAGE = 'Usage: /inj-setup [default|custom|edit|show|set <text>]';

export function handleInjCommand(host: SlashCommandHost, args: string): void {
  if (args.length === 0) {
    host.showError('Usage: /inj <text>');
    return;
  }
  host.sendInjectedUserInput(args, {
    thinkingPrefill: resolveThinkingPrefill(host.state.appState.inj),
    restoreText: `/inj ${args}`,
  });
}

export async function handleInjSetupCommand(host: SlashCommandHost, args: string): Promise<void> {
  const match = /^(\S*)\s*([\s\S]*)$/.exec(args);
  const subcommand = match?.[1]?.toLowerCase() ?? '';
  const rest = match?.[2] ?? '';
  const current = host.state.appState.inj ?? DEFAULT_INJ_CONFIG;
  switch (subcommand) {
    case '':
      showInjSetupPicker(host, current);
      return;
    case 'show':
      showInjSetting(host, current);
      return;
    case 'default':
      await applyInjConfig(host, { ...current, mode: 'default' });
      return;
    case 'custom':
      if (current.customText.trim().length === 0) {
        host.showError('No custom prefix saved yet. Use /inj-setup set <text> or /inj-setup edit.');
        return;
      }
      await applyInjConfig(host, { ...current, mode: 'custom' });
      return;
    case 'set':
      if (rest.trim().length === 0) {
        host.showError('Usage: /inj-setup set <text>');
        return;
      }
      await applyInjConfig(host, { mode: 'custom', customText: rest });
      return;
    case 'edit':
      // The main editor is multi-line (and Ctrl-G opens the external editor),
      // so editing is a prefilled `/inj-setup set` the user adjusts and submits.
      host.restoreInputText(`/inj-setup set ${current.customText}`);
      host.showStatus('Edit the custom prefix, then submit to save it.');
      return;
    default:
      host.showError(INJ_SETUP_USAGE);
      return;
  }
}

function showInjSetupPicker(host: SlashCommandHost, current: InjConfig): void {
  const hasCustom = current.customText.trim().length > 0;
  host.mountEditorReplacement(
    new ChoicePickerComponent({
      title: 'Thinking prefix for /inj',
      currentValue: current.mode,
      options: [
        { value: 'default', label: 'Default prefix', description: DEFAULT_THINKING_PREFILL },
        {
          value: 'custom',
          label: 'Custom prefix',
          description: hasCustom ? firstLine(current.customText) : 'No custom text saved yet — choose Edit',
        },
        { value: 'edit', label: 'Edit custom text…', description: 'Multi-line; saved custom text is kept when switching back to default' },
        { value: 'show', label: 'Show current setting' },
      ],
      onSelect: (value) => {
        host.restoreEditor();
        void handleInjSetupCommand(host, value);
      },
      onCancel: () => {
        host.restoreEditor();
      },
    }),
  );
}

function showInjSetting(host: SlashCommandHost, current: InjConfig): void {
  const active = resolveThinkingPrefill(current);
  const custom = current.customText.trim().length > 0 ? current.customText : '(none)';
  host.showNotice(
    `/inj mode: ${current.mode}`,
    `Active prefix:\n${active}\n\nSaved custom text:\n${custom}`,
  );
}

async function applyInjConfig(host: SlashCommandHost, inj: InjConfig): Promise<void> {
  try {
    await saveTuiConfig({ ...currentTuiConfig(host), inj });
  } catch (error) {
    host.showStatus(`Failed to save /inj setting: ${formatErrorMessage(error)}`, 'error');
    return;
  }
  host.setAppState({ inj });
  host.showStatus(
    inj.mode === 'custom'
      ? `/inj now uses the custom prefix: ${firstLine(inj.customText)}`
      : '/inj now uses the default prefix.',
  );
}

function firstLine(text: string): string {
  const [line = ''] = text.trim().split('\n');
  return line.length < text.trim().length ? `${line} …` : line;
}
