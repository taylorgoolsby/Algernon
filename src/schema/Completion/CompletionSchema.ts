// @flow

import gql from "graphql-tag";
import type { GPTMessage } from "../../types/GPTMessage.js";
import type { ModelConfig } from "../../types/ModelConfig.js";

export const CompletionType = {
  GENERAL: 'GENERAL',
  SHORT_TERM_MEMORY: 'SHORT_TERM_MEMORY',
  LONG_TERM_MEMORY: 'LONG_TERM_MEMORY',
} as const

export type CompletionTypeEnum = keyof typeof CompletionType

export type CompletionSQL = {
  completionId: number,
  type: CompletionTypeEnum,
  model: ModelConfig,
  inputs: Array<GPTMessage>,
  output: GPTMessage,
  dateCreated: string
}

export const typeDefs: any = gql`
  type Completion {
    completionId: Int @sql(primary: true, auto: true)
    type: String @sql(type: "TEXT")
    model: JSON @sql(type: "TEXT")
    inputs: JSON @sql(type: "TEXT")
    output: JSON @sql(type: "TEXT")
    dateCreated: String @sql(type: "TIMESTAMP", default: "CURRENT_TIMESTAMP")

    id: String
  }
`
