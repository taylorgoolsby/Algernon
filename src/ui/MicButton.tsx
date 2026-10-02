import { useState, useEffect } from "react";
import { TouchableOpacity, ActivityIndicator, View } from "react-native"
import { footerInactive, footerActive } from "../Colors"
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { NativeModules } from 'react-native'
import {
  check,
  request,
  openSettings,
  PERMISSIONS,
  RESULTS,
} from 'react-native-permissions'

const { AudioTranscription } = NativeModules

type MicButtonProps = {
  onTranscriptionComplete?: (transcription: string) => void
}

const MicButton = (props: MicButtonProps) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceReady, setVoiceReady] = useState(false)

  async function checkAndRequestAudio() {
    let micCheck = await check(PERMISSIONS.IOS.MICROPHONE)

    if (micCheck !== RESULTS.GRANTED) {
      micCheck = await request(PERMISSIONS.IOS.MICROPHONE)
    }

    if (micCheck === RESULTS.BLOCKED) {
      openSettings().catch(console.error)
    }

    return micCheck === RESULTS.GRANTED
  }

  useEffect(() => {
    AudioTranscription.initialize()
      .then((message: string) => {
        console.log(message)
        setVoiceReady(true)
      })
      .catch((error: string) => {
        console.error(error)
      })
  }, [])

  const startSpeechToText = async () => {
    const permissionsGranted = await checkAndRequestAudio()

    if (!permissionsGranted || !voiceReady) {
      return
    }

    setIsRecording(true)

    AudioTranscription.onData((transcription: string) => {
      setIsTranscribing(false)

      const cleanTranscription =
        transcription.replace(/\[BLANK_AUDIO\]/g, '')

      console.log('cleanTranscription', cleanTranscription)
      if (props.onTranscriptionComplete) props.onTranscriptionComplete(cleanTranscription)
    })

    AudioTranscription.onError((errorMessage: string) => {
      setIsTranscribing(false)
      console.error('Transcription error:', errorMessage)
    })

    AudioTranscription.start()
      .then((message: string) => console.log(message))
      .catch((error: string) => {
        setIsRecording(false)
        console.error(error)
      })
  }

  const stopSpeechToText = async () => {
    if (!isRecording) {
      return
    }

    setIsRecording(false)
    setIsTranscribing(true)

    AudioTranscription.stop()
      .then((message: string) => console.log(message))
      .catch((error: string) => {
        setIsTranscribing(false)
        console.error(error)
      })
  }

  return (
    <TouchableOpacity
      onPress={isRecording ? stopSpeechToText : startSpeechToText}
      disabled={isTranscribing}
    >
      {isTranscribing ? (
        <View
          style={{
            width: 24,
            height: 24,
            marginRight: 23,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="small" color={footerActive} />
        </View>
      ) : (
        <Ionicons
          style={{
            marginTop: 0,
            marginRight: 23,
          }}
          name={'mic'}
          size={24}
          color={isRecording ? footerActive : footerInactive}
        />
      )}
    </TouchableOpacity>
  )
}

export default MicButton