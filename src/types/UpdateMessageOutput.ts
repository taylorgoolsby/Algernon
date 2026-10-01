// @flow

import type {MessageSQL} from "../schema/Message/MessageSchema";

export type UpdateMessageOutput = {
  windowId: number,
  message: MessageSQL,
}
