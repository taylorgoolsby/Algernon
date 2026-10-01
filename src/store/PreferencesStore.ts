// @flow

import RNFS from 'react-native-fs'
import type {ModelConfig} from '../types/ModelConfig'
import {makeObservable, observable, computed} from 'mobx'
import Config from "../Config";

/*
export type ModelConfig = {
  // This tries to conform to the naming scheme used by continue.dev config: https://continue.dev/docs/reference/Model%20Providers/openai
  title: string,
  apiBase: string,
  apiKey?: ?string,
  completionOptions?: ?{ ... },
}
*
*/

export type EditableModelConfig = {
  local?: boolean | null | undefined,
  title: string,
  apiBase: string,
  apiKey: string | undefined,
  completionOptions: Array<{name: string, value: string}>,
}

const path = `${RNFS.DocumentDirectoryPath}/preferences.json`

const defaultModels: Array<EditableModelConfig> = [
  {
    title: 'Mistral Small',
    apiBase: 'https://api.mistral.ai',
    apiKey: Config.mistralApiKey,
    completionOptions: [{name: 'model', value: 'mistral-small-latest'}],
  },
  // {
  //   title: 'Claude 3 Haiku',
  //   apiBase: 'https://api.anthropic.com',
  //   apiKey: Config.claudeApiKey,
  //   completionOptions: [{name: 'model', value: 'claude-3-haiku-20240307'}],
  // },
  {
    title: 'GPT 3.5',
    apiBase: 'https://api.openai.com',
    apiKey: Config.openAiApiKey,
    completionOptions: [{name: 'model', value: 'gpt-3.5-turbo'}],
  }
]

export class PreferencesStore {
  loaded: boolean = false
  models: Array<ModelConfig> = []
  editableModels: Array<EditableModelConfig> = []
  selectedModelIndex: number = 0
  introCompleted: boolean = true

  constructor() {
    makeObservable(this, {
      loaded: observable,
      models: observable,
      selectedModelIndex: observable,
      selectedModel: computed,
      introCompleted: observable,
    })
  }

  get selectedModel(): ModelConfig {
    if (this.models[this.selectedModelIndex]) {
      return this.models[this.selectedModelIndex]
    } else {
      return {
        ...defaultModels[0],
        completionOptions: {},
      }
    }
  }

  reset() {
    this.loaded = true
    this.editableModels = defaultModels
    this.updateModels(this.editableModels)
    this.selectedModelIndex = 0
    this.introCompleted = true
  }

  updateModels(models: Array<EditableModelConfig>) {
    if (!models.length) {
      models = defaultModels
    }
    this.editableModels = models

    // Remove incomplete data and convert completionOptions to object format:
    this.models = models
      .filter(model => !!model.local || !!model.title)
      .map((model: EditableModelConfig) => {
        return {
          ...model,
          completionOptions: model.completionOptions
            .filter(option => !!option.name)
            .reduce((acc: { [key: string]: string }, option) => {
              // $FlowFixMe
              acc[option.name] = option.value
              return acc
            }, {}),
        }
      })
  }

  async save(): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded')
    }

    const preferences = {
      editableModels: this.editableModels,
      selectedModelIndex: this.selectedModelIndex,
      introCompleted: this.introCompleted,
    }
    console.log('saving preferences', JSON.stringify(preferences))
    await RNFS.writeFile(path, JSON.stringify(preferences), 'utf8')
  }

  async load(): Promise<void> {
    let preferences

    try {
      const preferencesJson = await RNFS.readFile(path, 'utf8')
      console.log('Preferences loaded', preferencesJson)
      preferences = JSON.parse(preferencesJson)
    } catch (err) {
      console.error(err)
      preferences = {
        editableModels: [],
        selectedModelIndex: 0,
      }
      console.log('saving preferences', JSON.stringify(preferences))
      await RNFS.writeFile(path, JSON.stringify(preferences), 'utf8')
    }

    // $FlowFixMe
    this.editableModels = preferences.editableModels ?? []
    if (!this.editableModels.length) {
      this.editableModels = defaultModels
    }

    // Convert models from EditableModelConfig to ModelConfig:
    // this.models = this.editableModels
    this.models = defaultModels
      .filter(model => !!model.local || !!model.title)
      .map((model: EditableModelConfig) => {
        return {
          ...model,
          completionOptions: model.completionOptions.reduce((acc: { [key: string]: string }, option) => {
            // $FlowFixMe
            acc[option.name] = option.value
            return acc
          }, {}),
        }
      })

    this.selectedModelIndex = preferences.selectedModelIndex ?? 0

    this.introCompleted = preferences.introCompleted ?? false

    this.loaded = true
  }

  selectModel(modelIndex: number) {
    this.selectedModelIndex = modelIndex
    this.save().catch(err => {
      console.error(err)
    })
  }

  showIntro() {
    this.introCompleted = false
  }

  completeIntro() {
    this.introCompleted = true
  }
}

const preferencesStore: PreferencesStore = new PreferencesStore()
export default preferencesStore
