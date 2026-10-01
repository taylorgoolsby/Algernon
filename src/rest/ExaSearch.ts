// @flow

import Config from "../Config";
import axios from "axios";
import parseAxiosError from "../utils/parseAxiosError";
import Exa from "exa-js"

const exa = new Exa(Config.exaSecret);

type ExaResult = {
  "score": number,
  "title": string,
  "id": string,
  "url": string,
  "publishedDate": string,
  "author": string,
  "text": string,
}

type ExaResponse = {
  autopromptString: string,
  results: Array<ExaResult>,
  requestId: string,
}

export default class ExaSearch {
  static async search(
    searchTerm: string,
  ): Promise<ExaResponse> {

    const result = await exa.searchAndContents(
      searchTerm,
      {
        type: "neural",
        useAutoprompt: true,
        numResults: 25,
        text: true
      }
    )

    // @ts-ignore
    return result
  }
}
