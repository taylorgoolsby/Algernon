// @flow

import { Appearance } from "react-native";

// export const darkMode = Appearance.getColorScheme() === 'dark'
export const darkMode = true

const defaultText = darkMode ? 'white' : 'rgba(0, 0, 0, 0.90)'

const blue = 'rgba(112, 163, 255, 0.9)'
const teal = 'rgba(132, 227, 151, 0.9)'
const red = 'rgb(215, 29, 29)'
const green = 'rgb(85, 191, 106)'
const white = 'white'

export const fadeTime: number = 100

export const shadow = {
  shadowColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
  shadowOffset: {width: 0, height: darkMode ? -1 : 1},
  shadowOpacity: 0.5,
  shadowRadius: 1,
  elevation: 1,
}

export const headerLeft: string = darkMode ? 'rgba(255, 255, 255, 0.99)' : 'rgba(0, 0, 0, 0.88)' //blue
export const headerRight: string = darkMode ? 'rgba(255, 255, 255, 0.99)' : 'rgba(0, 0, 0, 0.88)' // opacity=0.3
export const userChat: string = blue
// export const aiChat: string = darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
export const aiChat: string = darkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.0)'
export const userText: string = 'white'
export const userText2: string = 'rgba(255, 255, 255, 0.5)'
export const userText2Active: string = 'white'
export const aiText: string = defaultText
export const aiText2: string = darkMode ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)'
export const aiText2Active: string = defaultText
export const inputText: string = defaultText
export const searchActive: string = darkMode ? '#82acfa' : blue
export const footerActive: string = darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.75)'
export const footerInactive: string = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.16)'

export default class {
  static defaultText: string = defaultText
  static settingsText: string = 'rgba(0, 0, 0, 0.90)'
  static darkBlue: string = '#090f2c'
  static blue: string = blue
  static teal: string = teal
  static violetLight: string = 'rgba(62, 56, 225, 1)'
  static violetDark: string = 'rgba(46, 42, 181, 1)'

  static gradient1: string = 'rgba(221, 253, 252, 1)'
  static gradient2: string = 'rgba(22, 11, 102, 1)'
  static gradient3: string = 'rgba(65, 189, 242, 1)'
  static gradient4: string = 'rgba(62, 56, 225, 1)'
  static gradient5: string = 'rgba(120, 201, 251, 1)'

  static fontWeight: string = '300'
  static fontSize: number = 14
  static letterSpacing: number = 0.07
  static fontFamily: string = 'Poppins'

  // static fontWeight: string = '300'
  // static fontSize: number = 15
  // static letterSpacing: number = 0.07
  // static fontFamily: string = 'Figtree'

  static chatBg: string = 'white'

  static chatHeaderBlurType: string = darkMode ? 'dark' : 'light'
  static chatFooterBlurType: string = darkMode ? 'dark' : 'light'

  static mainBg: string = 'rgb(196, 219, 255)'
  static secondaryBg: string = 'white'

  static introCloseButton: string = 'rgba(255, 255, 255, 0.8)'
  static introText: string = 'rgba(255, 255, 255, 0.92)'
  // static introSelectedOption = 'rgba(85, 191, 106, 1)'
  static introSelectedOption: string = 'rgba(57, 163, 78, 1)'
  static introSelectedOptionText: string = defaultText
  static introSlideUpBg: string = 'rgba(9, 15, 44, 0.7)'
  // static introSlideUpBg = 'rgba(0, 0, 0, 0.2)'

  static trashIcon: string = defaultText

  // static settingsButtonBg = 'rgba(112, 163, 255, 0.1)'
  static settingsButtonBg: string = 'rgba(196, 219, 255, 0.4)'
  static settingsButtonText: string = defaultText
  static sendIconBg: string = darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.8)'
  static sendIconDisabledBg: string = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.24)'
  static inputText: string = inputText

  /*
  * CHAT BUBBLE START
  * */

  static userBubbleBg: string = 'rgba(112, 163, 255, 0.97)'
  static aiBubbleBg: string = 'rgba(112, 163, 255, 0.97)'

  // const defaultText = darkMode ? 'white' : 'rgba(0, 0, 0, 0.90)'

  static userBubbleText1: string = userText
  static aiBubbleText1: string = aiText
  static userBubbleText2: string = userText2
  static aiBubbleText2: string = aiText2

  /*
  * CHAT BUBBLE END
  * */

  // const blue = 'rgba(112, 163, 255, 0.9)'
  // static spinnerColor1: string = blue
  // static spinnerColor2: string = blue
  static spinnerColor1: string = darkMode ? 'rgba(138, 192, 255, 0.9)' : 'rgba(139, 180, 255, 0.9)'
  static spinnerColor2: string = darkMode ? 'rgba(138, 192, 255, 0.9)' : 'rgba(139, 180, 255, 0.9)'
}
