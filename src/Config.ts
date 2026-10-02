// @flow

import RNConfig from "react-native-config";

export default class Config {
  // $FlowFixMe
  static stage: string = __DEV__ ? 'debug' : 'release';
  static appSalt: string | undefined = RNConfig.APP_SALT;

  static openAiApiKey: string | undefined = RNConfig.OPENAI_API_KEY;
  static claudeApiKey: string | undefined = RNConfig.CLAUDE_API_KEY;
  static mistralApiKey: string | undefined = RNConfig.MISTRAL_API_KEY;

  static codePushKey: string | undefined = RNConfig.APP_CENTER_SECRET;

  static awsAccessKeyId: string | undefined = RNConfig.AWS_ACCESS_KEY_ID;
  static awsSecretAccessKey: string | undefined = RNConfig.AWS_SECRET_ACCESS_KEY;

  static bingSecret: string | undefined = RNConfig.BING_SECRET;
  static exaSecret: string | undefined = RNConfig.EXA_SECRET;

  static monthlyProductId: string = 'sub1.monthly1'
  static annualProductId: string = 'sub1.annual1'
  static tokensPerChar: number = 0.17421777221526907
}
