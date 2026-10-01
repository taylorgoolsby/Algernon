// @flow

import gql from 'graphql-tag'
import type { GPTMessage } from '../../types/GPTMessage.js'
import type { ModelConfig } from "../../types/ModelConfig.js";

export type ShortTermMemorySQL = {
  shortTermMemoryId: number,
  model: ModelConfig,
  inputs: Array<GPTMessage>,
  summary: string,
  dateCreated: string,
}

export const typeDefs: any = gql`
  type ShortTermMemory {
    shortTermMemoryId: Int @sql(primary: true, auto: true)
    windowId: Int @sql(type: "INT", default: "0")
    model: JSON @sql(type: "TEXT")
    inputs: JSON @sql(type: "TEXT")
    summary: String @sql(type: "TEXT", unicode: true)
    dateCreated: String @sql(type: "TIMESTAMP", default: "CURRENT_TIMESTAMP")

    id: String
  }
`
