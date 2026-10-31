import { type FlagDefinitionInput, registerFlagDefinition } from '#/app/flag/flagRegistry';
import type { ThinkingEffort } from '#human/llm-requester/thinking';
import type { Model } from '#/llm-adapter/model/catalog';
import { ErrorCodes, Error2 } from '#/errors';

export const THINKING_PREFILL_FLAG_ID = 'thinking-prefill';
export const THINKING_PREFILL_FLAG_ENV = 'KIMI_CODE_EXPERIMENTAL_THINKING_PREFILL';

export const thinkingPrefillFlag: FlagDefinitionInput = {
  id: THINKING_PREFILL_FLAG_ID,
  title: 'Thinking prefill (/inj)',
  description:
    'Let a prompt carry a thinking prefix that the first model step continues from, sent to the Kimi platform as a trailing partial assistant message with reasoning_content.',
  env: THINKING_PREFILL_FLAG_ENV,
  default: true,
  surface: 'core',
};

registerFlagDefinition(thinkingPrefillFlag);

export function assertThinkingPrefillSupported(
  enabled: boolean,
  model: Model,
  thinkingEffort: ThinkingEffort | undefined,
): void {
  if (!enabled) {
    throw new Error2(
      ErrorCodes.REQUEST_INVALID,
      `thinkingPrefill is disabled (${THINKING_PREFILL_FLAG_ENV} is off)`,
    );
  }
  if (model.providerType !== 'kimi' || model.protocol !== 'openai') {
    throw new Error2(
      ErrorCodes.REQUEST_INVALID,
      `thinkingPrefill requires a Kimi provider on the OpenAI Chat Completions protocol; model "${model.name}" uses provider "${model.providerType ?? 'unknown'}" with protocol "${model.protocol}"`,
    );
  }
  if (thinkingEffort === 'off') {
    throw new Error2(
      ErrorCodes.REQUEST_INVALID,
      'thinkingPrefill requires thinking to be enabled; current thinking effort is "off"',
    );
  }
}
