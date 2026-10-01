// ClusteringAndEllipsoids.h
#import <Foundation/Foundation.h>

@interface ClusteringAndEllipsoids : NSObject

- (NSDictionary *)performClusteringAndEllipsoids:(float *)data rows:(int)rows cols:(int)cols;
- (void)freeClusteringData:(NSDictionary *)clusteringResults;
+ (NSDictionary *)decompose2x2:(float[2][2])covarianceMatrix;
+ (NSDictionary *)decompose3x3:(float[3][3])covarianceMatrix;
+ (float)getVarianceAlongDirection:(float[3])direction covarianceMatrix:(float[3][3])covarianceMatrix;

@end
