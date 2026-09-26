// LLMNativeModule.m

#import "React/RCTBridgeModule.h"

@interface RCT_EXTERN_MODULE(LLMNativeModule, NSObject)

// Expose the generateResponse method from Swift
RCT_EXTERN_METHOD(generateResponse:(NSString *)text resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Expose the loadModel method from Swift
RCT_EXTERN_METHOD(loadModel:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
