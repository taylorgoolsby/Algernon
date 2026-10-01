// @flow

import type {MessageSQL} from "../schema/Message/MessageSchema";

export type AppendMessageOutput = {
  windowId: number,
  message: MessageSQL,
}
