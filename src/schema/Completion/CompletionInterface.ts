// @flow

import sqltag, { join } from '@taylorgoolsby/sql-template-tag'
import database from '../database'
import type {CompletionTypeEnum} from "./CompletionSchema";
import type { GPTMessage } from "../../types/GPTMessage";
import type { ModelConfig } from "../../types/ModelConfig";

export default class CompletionInterface {
  static async insert(type: CompletionTypeEnum, model: ModelConfig, inputs: Array<GPTMessage>, output: GPTMessage): Promise<number> {
    const query = sqltag`
      INSERT INTO Completion (
        type,
        model,
        inputs,
        output
      ) VALUES (
        ${type},
        ${JSON.stringify(model)},
        ${JSON.stringify(inputs)},
        ${JSON.stringify(output)}
      );
    `

    const res = await database.query(query)

    const completionId = res.insertId

    return completionId
  }

  static async truncateTable() {
    const sql = sqltag`DELETE FROM Completion;`
    await database.query(sql)
  }
}
