// src/ui/ModelStatusBanner.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { observer } from 'mobx-react-lite'
import Text from './Text'
import Colors from '../Colors'
import { extraHeight } from './ChatHeader'
import { chatStore } from '../store/ChatStore'

// How long loading the model into memory usually takes. The bar creeps
// toward CREEP_MAX over this time so it keeps moving even when the native
// side reports no progress (cached model, or after the download finished).
const EXPECTED_LOAD_MS = 5000
const CREEP_MAX = 0.95
// If a download happens, it fills the first part of the bar; the creep fills
// the rest.
const DOWNLOAD_SHARE = 0.7

// "mlx-community/Llama-3.2-1B-Instruct-4bit" -> "Llama-3.2-1B-Instruct-4bit"
const shortName = (name: string) => name.split('/').pop() || name

// Shown just below the header while the model is downloading / loading,
// and if loading failed. Fades out once the model is ready.
const ModelStatusBanner = observer(() => {
  const safeAreaInsets = useSafeAreaInsets()
  const { modelStatus, modelProgress, modelName, modelError } = chatStore

  const fill = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const fillValue = useRef(0) // current value of `fill`, readable synchronously
  const [visible, setVisible] = useState(false)

  const downloading = modelProgress > 0 && modelProgress < 1

  useEffect(() => {
    const id = fill.addListener(({ value }) => {
      fillValue.current = value
    })
    return () => fill.removeListener(id)
  }, [fill])

  // Show / hide.
  useEffect(() => {
    if (modelStatus === 'loading') {
      fill.stopAnimation()
      fill.setValue(0)
      opacity.setValue(1)
      setVisible(true)
    } else if (modelStatus === 'error') {
      fill.stopAnimation()
      opacity.setValue(1)
      setVisible(true)
    } else if (modelStatus === 'ready' && visible) {
      // Finish the bar, then fade the banner out.
      fill.stopAnimation()
      Animated.sequence([
        Animated.timing(fill, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.delay(250),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus])

  // Drive the bar while loading.
  useEffect(() => {
    if (modelStatus !== 'loading') return
    fill.stopAnimation()
    if (downloading) {
      // Real progress. Never move backwards if the creep got ahead of it.
      Animated.timing(fill, {
        toValue: Math.max(fillValue.current, modelProgress * DOWNLOAD_SHARE),
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start()
    } else {
      // No progress to report: anticipate the load time.
      Animated.timing(fill, {
        toValue: CREEP_MAX,
        duration: EXPECTED_LOAD_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus, downloading, modelProgress])

  if (!visible) return null

  const isError = modelStatus === 'error'
  const percent = Math.round(modelProgress * 100)

  let label: string
  if (isError) {
    label = `Failed to load model${modelError ? `: ${modelError}` : ''}`
  } else if (modelStatus === 'ready') {
    label = 'Model ready'
  } else if (downloading) {
    label = `Downloading ${shortName(modelName)}… ${percent}%`
  } else {
    label = 'Loading model…'
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { top: safeAreaInsets.top + extraHeight, opacity },
      ]}
    >
      <Text style={[styles.label, isError && styles.error]} numberOfLines={2}>
        {label}
      </Text>
      {!isError && (
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                width: fill.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  error: {
    color: 'rgb(255, 120, 120)',
  },
  track: {
    height: 3,
    marginTop: 6,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  fill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.blue,
  },
})

export default ModelStatusBanner