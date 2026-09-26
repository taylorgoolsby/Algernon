// @flow

export type ModelConfig = {
  local?: boolean | null,
  // This tries to conform to the naming scheme used by continue.dev config: https://continue.dev/docs/reference/Model%20Providers/openai
  title: string,
  apiBase: string,
  apiKey?: string | null,
  completionOptions?: Record<string, unknown> | null,
}
