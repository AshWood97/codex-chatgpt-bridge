import { assert } from './errors.js';
import type { Mode } from './types.js';

export interface SelectionOption {
  label: string;
  selected: boolean;
  visible: boolean;
  disabled?: boolean;
}
export interface ModelSelectionEvidence {
  models: SelectionOption[];
  efforts?: SelectionOption[];
}

function selected(options: SelectionOption[], control: string) {
  const choices = options.filter(option => option.visible && option.selected);
  assert(choices.length === 1, 'SELECTION_AMBIGUOUS', `Observe exactly one selected ${control} option in the active control.`);
  const choice = choices[0]!;
  assert(choice.label.trim() && !choice.disabled, 'SELECTION_UNAVAILABLE', `The selected ${control} option must be available and named.`);
  return choice.label;
}

// Labels must come from the model picker / effort control, never a plan badge,
// assistant response, hidden menu, or the numerical position of a slider.
export function isProSelection(model: string, effort?: string) {
  return /(?:^|[\s-])pro(?:$|\s)/i.test(model.trim()) || effort?.trim().toLowerCase() === 'pro';
}

export function resolveModelSelection(evidence: ModelSelectionEvidence) {
  const model = selected(evidence.models, 'model');
  const effort = evidence.efforts === undefined ? undefined : selected(evidence.efforts, 'effort');
  return { model, effort, mode: isProSelection(model, effort) ? 'pro' as const : 'chat' as const };
}

export function checkChatSelection(model: string, mode: Mode, effort?: string) {
  if (mode !== 'chat' && mode !== 'pro') return;
  assert(isProSelection(model, effort) === (mode === 'pro'), 'PRO_SELECTION_MISMATCH',
    'Pro requires a selected Pro model or Pro effort. High/Max and subscription badges are not Pro selection evidence; do not silently downgrade.');
}
