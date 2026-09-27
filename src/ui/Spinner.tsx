// @flow

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Colors from "./Colors";


const Spinner = ({style, dieOut, onLayout}: any): any => {
  const startTime = useRef(Date.now());
  const dieOutAnimation = useRef(new Animated.Value(0)).current;

  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (dieOut) {
      startTime.current = Date.now();
      Animated.sequence([
        Animated.timing(dieOutAnimation, {
          toValue: 1,
          duration: 1875,
          easing: t => {
            const d = (Date.now() - startTime.current)
            const s = 1875
            return Math.min( d * d * d / s / s / s, 1)
          },
          useNativeDriver: false,
        })
      ]).start()
    }
  }, [dieOut, dieOutAnimation]);

  useEffect(() => {
    startTime.current = Date.now();
    Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 1875,
          easing: t => {
            return Math.sin(t * Math.PI * 2)
          },
          useNativeDriver: false,
        })
      ])
    ).start();
  }, [animation]);

  return (
    <Animated.View onLayout={onLayout} style={[styles.container, style, {transform: [{translateX: 0.5}, {scale: dieOutAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0]
        })}]}]}>
      <Animated.View
        style={[
          styles.circle,
          {
            opacity: animation.interpolate({
              // inputRange: [0, 0.5, 1],
              // outputRange: [1, 0.3, 1], // Change the opacity in a sinusoidal pattern
              inputRange: [0, 1],
              outputRange: [0.3, 1], // Change the opacity in a sinusoidal pattern
            }),
            transform: [{scale: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [1.2, 1.4], // Reverse the radius pattern for the second circle
              })}],
            backgroundColor: Colors.spinnerColor1
            // backgroundColor: 'red'
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          {
            opacity: animation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0], // Reverse the opacity pattern for the second circle
            }),
            transform: [{scale: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.86, 0.4], // Reverse the radius pattern for the second circle
              })}],
            backgroundColor: Colors.spinnerColor2
            // backgroundColor: 'red'
          },
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
    width: 20,
    marginTop: 3,
    // backgroundColor: '#FFF',
  },
  circle: {
    position: 'absolute',
    backgroundColor: Colors.blue,
    opacity: 0.5,
    height: 10,
    width: 10,
    borderRadius: 5,
  },
});


export default Spinner
