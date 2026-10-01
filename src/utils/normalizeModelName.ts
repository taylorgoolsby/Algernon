// @flow

import type { ModelConfig } from "../types/ModelConfig";

// $FlowFixMe
export default function normalizeModelName(model: ModelConfig): string {
  // $FlowFixMe
  // if (model.completionOptions?.model === 'gpt-4-turbo-preview') {
  //   return 'gpt-4'
  //   // $FlowFixMe
  // } else if (model.completionOptions?.model) {
  //   // $FlowFixMe
  //   return model.completionOptions?.model
  // } else if (model.title.toLowerCase().includes('phi')) {
  //   return 'phi-2'
  // } else {
  //   return 'gpt-3.5-turbo'
  // }
  return 'gpt-3.5-turbo'
}
