// @flow

export type ChatCompletionsResponse = {
  id?: string,
  choices: Array<{
    index?: number,
    delta?: {
      content: string,
      tool_calls: Array<{
        id: string,
        type: string,
        function: {
          name: string,
          arguments: string,
        },
      }>,
      role: string,
    },
    message?: {
      content: string,
      tool_calls?: Array<{
        id: string,
        type: string,
        function: {
          name: string,
          arguments: string,
        },
      }>,
      role: string,
    },
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null,
  }>,
  created?: number,
  model?: string,
  system_fingerprint?: string,
  object?: string,
  usage?: {
    completion_tokens: number,
    prompt_tokens: number,
    total_tokens: number,
  },
}
