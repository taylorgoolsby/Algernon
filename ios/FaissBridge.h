// FaissBridge.h
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

@interface FaissBridge : NSObject <RCTBridgeModule>

+ (instancetype)sharedInstance;
- (NSDictionary *)getVectors;

@end
