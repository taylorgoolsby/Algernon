// PlotView.tsx
import React from 'react';
import { requireNativeComponent } from 'react-native';

// $FlowFixMe
const PlotViewNative = requireNativeComponent('PlotView');

const PlotView: any = (props: any) => {
  return <PlotViewNative {...props} />;
};

export default PlotView;
