// FaissBridge.m
#import "FaissBridge.h"
#include "IndexFlat_c.h"
#include "faiss_c.h"
#include "index_io_c.h"
#import "Algernon-Swift.h"
#import "ClusteringAndEllipsoids.h"

@implementation FaissBridge {
    FaissIndex* index;
    int dimension;
}

// To expose this module to React Native
RCT_EXPORT_MODULE();

// Indicate that this module should be initialized on the main queue
+ (BOOL)requiresMainQueueSetup {
    return YES;
}

// Singleton instance
+ (instancetype)sharedInstance {
    static FaissBridge *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

// Initialize FAISS with a fixed dimension
- (instancetype)init {
    self = [super init];
    if (self) {
        dimension = 384;
        if (![self readIndexFromFile]) {
            [self initializeIndex];
            [self writeIndexToFile];
        }
    }
    return self;
}

- (void)initializeIndex {
    faiss_IndexFlat_new_with(&index, (idx_t)dimension, METRIC_INNER_PRODUCT);
}

// Method to delete the entire index and reinitialize
RCT_EXPORT_METHOD(deleteAndReinitialize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    FaissBridge *sharedInstance = [FaissBridge sharedInstance];
    if (!sharedInstance->index) {
        reject(@"index_error", @"FAISS has not been initialized", nil);
        return;
    }

    faiss_Index_free((FaissIndex *)sharedInstance->index);
    sharedInstance->index = NULL; // Ensure the pointer is set to NULL after freeing
    
    // Get the file path for the index
    NSString *filePath = [sharedInstance indexPath];
    
    // Create a file manager instance
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    // Check if the index file exists
    if ([fileManager fileExistsAtPath:filePath]) {
        NSError *error;
        
        // Attempt to delete the file
        if (![fileManager removeItemAtPath:filePath error:&error]) {
            // If there is an error deleting the file, reject the promise with the error details
            reject(@"delete_error", @"Failed to delete index file", error);
            return;
        }
    }

    // Reinitialize the index
    [sharedInstance initializeIndex];
    [sharedInstance writeIndexToFile];
  
    NSLog(@"Pointer value of index after reinitialization: %p", sharedInstance->index);
    
    // If everything is successful, resolve the promise
    resolve(@(YES));
}

// Method to get the total number of vectors in the index
RCT_EXPORT_METHOD(ntotal:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    FaissBridge *sharedInstance = [FaissBridge sharedInstance];
    if (!sharedInstance->index) {
        reject(@"index_error", @"FAISS has not been initialized", nil);
        return;
    }

    // Get the total number of vectors in the index
    int ntotal = (int)faiss_Index_ntotal((FaissIndex *)sharedInstance->index);
    
    // Return the total number of vectors
    resolve(@(ntotal));
}

// Method to add a vector to the index
RCT_EXPORT_METHOD(addVector:(NSArray<NSNumber *> *)vector
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    FaissBridge *sharedInstance = [FaissBridge sharedInstance];
    if (!sharedInstance->index) {
        reject(@"index_error", @"FAISS has not been initialized", nil);
        return;
    }
    
    // Convert NSArray to C array
    float *c_vector = malloc(vector.count * sizeof(float));
    if (!c_vector) {
        reject(@"memory_error", @"Failed to allocate memory for vector", nil);
        return;
    }
    for (NSUInteger i = 0; i < vector.count; ++i) {
        c_vector[i] = [vector[i] floatValue];
    }
  
    int ntotal = (int)faiss_Index_ntotal((FaissIndex *)sharedInstance->index);
    
    // Add the vector to the index
    if (faiss_Index_add((FaissIndex *)sharedInstance->index, 1, c_vector) != 0) {
        free(c_vector);
        reject(@"add_error", @"Failed to add vector to index", nil);
        return;
    }
    free(c_vector);
    
    // Write the updated index to file
    if (![sharedInstance writeIndexToFile]) {
        reject(@"write_error", @"Failed to write updated index to file", nil);
        return;
    }
    
    // Return success
    resolve(@(ntotal));
}

// Method to search the index for the k nearest vectors
RCT_EXPORT_METHOD(searchVectors:(NSArray<NSNumber *> *)queryVector
                  numberOfResults:(NSInteger)k
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    FaissBridge *sharedInstance = [FaissBridge sharedInstance];
    if (!sharedInstance->index) {
        reject(@"index_error", @"FAISS has not been initialized", nil);
        return;
    }
    
    // Convert NSArray to C array for the query vector
    float *c_query = malloc(queryVector.count * sizeof(float));
    if (!c_query) {
        reject(@"memory_error", @"Failed to allocate memory for query vector", nil);
        return;
    }
    for (NSUInteger i = 0; i < queryVector.count; ++i) {
        c_query[i] = [queryVector[i] floatValue];
    }
    
    // Allocate memory for results
    faiss_idx_t *labels = malloc(k * sizeof(faiss_idx_t));
    float *distances = malloc(k * sizeof(float));
    if (!labels || !distances) {
        free(c_query);
        free(labels);
        free(distances);
        reject(@"memory_error", @"Failed to allocate memory for search results", nil);
        return;
    }
    
    // Perform the search
    faiss_Index_search((FaissIndex *)sharedInstance->index, 1, c_query, k, distances, labels);
    
    // Convert search results to NSArray for distances and labels
    NSMutableArray *distanceArray = [NSMutableArray arrayWithCapacity:k];
    NSMutableArray *labelArray = [NSMutableArray arrayWithCapacity:k];
    for (NSUInteger i = 0; i < k; ++i) {
        [distanceArray addObject:@(distances[i])];
        [labelArray addObject:@(labels[i])];
    }
    NSDictionary *resultDict = @{@"distances": distanceArray, @"labels": labelArray};
    
    // Clean up
    free(c_query);
    free(labels);
    free(distances);
    
    // Return the search results
    resolve(resultDict);
}

//RCT_EXPORT_METHOD(retrain:(RCTPromiseResolveBlock)resolve
//                  rejecter:(RCTPromiseRejectBlock)reject) {
//    FaissBridge *sharedInstance = [FaissBridge sharedInstance];
//    if (!sharedInstance->index) {
//        reject(@"index_error", @"FAISS has not been initialized", nil);
//        return;
//    }
//
//    int ntotal = (int)faiss_Index_ntotal((FaissIndex *)sharedInstance->index);
//
//    // Retrieve the data from the index using reconstruct_n
//    float* database = (float*)malloc(ntotal * sharedInstance->dimension * sizeof(float));
//    faiss_Index_reconstruct_n((FaissIndex *)sharedInstance->index, 0, ntotal, database);
//
//    // Use the new class for clustering and ellipsoids
//    ClusteringAndEllipsoids *clustering = [[ClusteringAndEllipsoids alloc] init];
//    NSDictionary *resultDict = [clustering performClusteringAndEllipsoids:database rows:ntotal cols:sharedInstance->dimension];
//
//    // Free allocated memory
//    free(database);
//
//    // Return the result
//    resolve(resultDict);
//}

// Method to retrieve vectors from the FAISS index without exposing to JS
- (NSDictionary *)getVectors {
    // Print the pointer value of the index
    NSLog(@"Pointer value of index at the beginning of getVectors: %p", index);
  
    if (!index) {
        return nil;
    }

    int ntotal = (int)faiss_Index_ntotal((FaissIndex *)index);

    // Retrieve the data from the index using reconstruct_n
    float* database = (float*)malloc(ntotal * dimension * sizeof(float));
    faiss_Index_reconstruct_n((FaissIndex *)index, 0, ntotal, database);

    NSMutableDictionary *resultDict = [NSMutableDictionary dictionary];
    resultDict[@"database"] = [NSValue valueWithPointer:database];
    resultDict[@"ntotal"] = @(ntotal);
    resultDict[@"dimension"] = @(dimension);

    return resultDict;
}

// Method to get the file path for the FAISS index within the app's document directory
- (NSString *)indexPath {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths firstObject];
    return [documentsDirectory stringByAppendingPathComponent:@"index.faiss"];
}

// Write the index to file
- (BOOL)writeIndexToFile {
    NSString *filePath = [self indexPath];
    const char *c_filePath = [filePath UTF8String];
    if (faiss_write_index_fname((FaissIndex *)index, c_filePath) != 0) {
        NSLog(@"Failed to write index to file");
        return NO;
    }
    return YES;
}

// New method to read and load the index from file
- (BOOL)readIndexFromFile {
    NSString *filePath = [self indexPath];
    const char *c_filePath = [filePath UTF8String];
    
    // Check if the file exists before attempting to read it
    NSFileManager *fileManager = [NSFileManager defaultManager];
    BOOL fileExists = [fileManager fileExistsAtPath:filePath];
    
    if (!fileExists) {
        NSLog(@"Index file does not exist");
        return NO;
    }
    
    // Attempt to read the index from the file
    FaissIndex *tempIndex = NULL;
    if (faiss_read_index_fname(c_filePath, 0, &tempIndex) != 0) {
        NSLog(@"Failed to read index from file");
        return NO;
    }
    
    // If there's an existing index, free it before replacing
    if (index != NULL) {
        faiss_Index_free((FaissIndex *)index);
    }
    
    // Update the index reference to the newly loaded index
    index = (FaissIndexFlat*)tempIndex;
    
    return YES;
}

@end
