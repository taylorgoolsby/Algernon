// TextFeatureExtractor.m

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TextFeatureExtractor, NSObject)

RCT_EXTERN_METHOD(extractFeatures:(NSString *)text resolver:(RCTPromiseResolveBlock)resolver rejecter:(RCTPromiseRejectBlock)rejecter)
RCT_EXTERN_METHOD(chunkText:(NSString *)text resolver:(RCTPromiseResolveBlock)resolver rejecter:(RCTPromiseRejectBlock)rejecter)

@end
