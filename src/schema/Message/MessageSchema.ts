// @flow

import gql from 'graphql-tag'
// import toSqlEnum from '../../utils/toSqlEnum.mjs'

export const MessageRole = {
  SYSTEM: 'SYSTEM',
  ASSISTANT: 'ASSISTANT',
  USER: 'USER',
} as const

export type MessageRoleType = keyof typeof MessageRole

export type MessageSQL = {
  messageId: number,
  windowId: number,
  promptedByMessageId: number | null | undefined,
  role: MessageRoleType,
  text: string,
  completed: boolean,
  deleted: boolean,
  dateUpdated: string,
  dateCreated: string,
}

/* 
We use graphql here, a backend tool, to generate the createTables script for us, mostly for practice, because
this project doesn't really need graphql at this time, although the resolvers feature in graphql might become useful later.
We could have more simply handwritten the SQL createTables script.

For more information see https://www.npmjs.com/package/graphql-to-sql
*/

export const typeDefs = gql`
  type Message {
    messageId: Int @sql(primary: true, auto: true)
    windowId: Int @sql(type: "INT", default: "0")
    promptedByMessageId: Int @sql(type: "INT", nullable: true)
    role: String @sql(type: "TEXT")
    text: String @sql(type: "TEXT")
    completed: Boolean @sql(type: "INT", default: "0")
    deleted: Boolean @sql(type: "INT", default: "0")
    dateUpdated: String @sql(type: "TIMESTAMP", default: "CURRENT_TIMESTAMP")
    dateCreated: String @sql(type: "TIMESTAMP", default: "CURRENT_TIMESTAMP")
  }
`
