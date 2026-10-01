// @flow

import React from 'react';
import {StyleSheet, Text} from "react-native";
import Colors from "../Colors";

const MyText: any = (props: any) => {
  const {
    style,
    children,
    ...rest
  } = props;

  return (
    <Text style={[styles.text, style]} {...rest}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: {
    color: Colors.defaultText,
    // @ts-ignore
    fontWeight: Colors.fontWeight,
    fontSize: Colors.fontSize,
    fontFamily: Colors.fontFamily,
    letterSpacing: Colors.letterSpacing,
    lineHeight: 24
  }
})

export default MyText
