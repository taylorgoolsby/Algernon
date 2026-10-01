// @flow

import axios from "axios";
import parseAxiosError from "../utils/parseAxiosError";
import Config from "../Config";

class BingSearch {
  static async search(
    searchTerm: string,
  ): Promise<any> {
    const url = 'https://api.bing.microsoft.com/v7.0/search'

    const config: any = {
      method: 'GET',
      url,
      params: {
        q: searchTerm,
        mkt: 'en-US',
      },
      headers: {
        'Ocp-Apim-Subscription-Key': Config.bingSecret
      },
      timeout: 10000
    }

    console.log("Config.bingSecret", Config.bingSecret);
    console.log("config", config);

    return axios(config).then(response => {
      return response.data
    })
      .catch(err => {
        // parseAxiosError will throw when a connection cannot be established.
        return parseAxiosError(err)
      })
      .then(response => {
        if (response.error) {
          throw new Error(response.error.message)
        } else {
          return response
        }
      })
  }
}

export default BingSearch
