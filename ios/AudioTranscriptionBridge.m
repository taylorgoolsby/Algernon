#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioTranscription, NSObject)

RCT_EXTERN_METHOD(initialize:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(start:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(onData:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(onError:(RCTResponseSenderBlock)callback)

@end
