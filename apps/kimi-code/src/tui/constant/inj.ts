import { DEFAULT_INJ_CONFIG, type InjConfig } from '#/tui/config';

export const DEFAULT_THINKING_PREFILL =
  'I should follow the user command. Now consider what to do. Should plan.';

/** The thinking prefix `/inj` sends: the saved custom text in custom mode, else the default. */
export function resolveThinkingPrefill(config: InjConfig = DEFAULT_INJ_CONFIG): string {
  return config.mode === 'custom' && config.customText.trim().length > 0
    ? config.customText
    : DEFAULT_THINKING_PREFILL;
}
