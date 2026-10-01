#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DatabaseModule, NSObject)

RCT_EXTERN_METHOD(initialize:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(executeQuery:(NSString *)query resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(format:(NSString *)query arguments:(NSArray *)arguments resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject)

@end
