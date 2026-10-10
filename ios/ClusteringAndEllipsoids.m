// ClusteringAndEllipsoids.m
#import "ClusteringAndEllipsoids.h"
#import <Accelerate/Accelerate.h>

@implementation ClusteringAndEllipsoids

- (NSDictionary *)performClusteringAndEllipsoids:(float *)data rows:(int)rows cols:(int)cols {
    // Determine the range of k to test
    int minK;
    if (rows < 300) {
        minK = 2;
    } else {
        minK = MAX(2, (int)sqrt(rows / 2));
    }
    int maxK = MIN(rows - 1, (int)sqrt(rows));

    // Ensure maxK is at least 2
    maxK = MAX(2, maxK);

    NSLog(@"Testing range of k: minK = %d, maxK = %d", minK, maxK);

    int maxIterations = 1000;

    // Perform deterministic k-means clustering with silhouette scoring
    NSDictionary *bestKMeansResult =
        [self performKMeansWithSilhouetteScoring:data
                                           rows:rows
                                           cols:cols
                                            minK:minK
                                            maxK:maxK
                                   maxIterations:maxIterations];

    int bestK = [bestKMeansResult[@"bestK"] intValue];
    float bestScore = [bestKMeansResult[@"bestScore"] floatValue];
    int *bestLabels = [bestKMeansResult[@"bestLabels"] pointerValue];
    float *bestCentroids = [bestKMeansResult[@"bestCentroids"] pointerValue];
    int *bestClusterCounts = [bestKMeansResult[@"bestClusterCounts"] pointerValue];

    NSMutableArray *allLabels = bestKMeansResult[@"allLabels"];
    NSMutableArray *allCentroids = bestKMeansResult[@"allCentroids"];
    NSMutableArray *allClusterSilhouetteScores = bestKMeansResult[@"allClusterSilhouetteScores"];
    NSMutableArray *allSilhouetteScores = bestKMeansResult[@"allSilhouetteScores"];
    NSMutableArray *allClusterCounts = bestKMeansResult[@"allClusterCounts"];

    // Perform PCA to reduce dimensions to 3D
    int reducedDim = 3;
    float *reducedData = malloc(rows * reducedDim * sizeof(float));

    [self performPCA:data
                rows:rows
                cols:cols
              output:reducedData
           outputDim:reducedDim];

    // Fit 3D Gaussian distributions and obtain ellipsoids
    NSMutableArray *ellipsoids =
        [self fit3DGaussianAndGetEllipsoid:reducedData
                                     rows:rows
                                   labels:bestLabels
                              numClusters:bestK
                               reducedDim:reducedDim
                             clusterCounts:bestClusterCounts];

    NSDictionary *resultDict = @{
        @"rows": @(rows),
        @"cols": @(cols),
        @"bestK": @(bestK),
        @"bestScore": @(bestScore),
        @"bestCentroids": [NSValue valueWithPointer:bestCentroids],
        @"bestLabels": [NSValue valueWithPointer:bestLabels],
        @"bestClusterCounts": [NSValue valueWithPointer:bestClusterCounts],
        @"bestEllipsoids": ellipsoids,
        @"allLabels": allLabels,
        @"allCentroids": allCentroids,
        @"allClusterSilhouetteScores": allClusterSilhouetteScores,
        @"allSilhouetteScores": allSilhouetteScores,
        @"allClusterCounts": allClusterCounts,
        @"reducedData": [NSValue valueWithPointer:reducedData]
    };

    return resultDict;
}

// Free memory associated with clustering results
- (void)freeClusteringData:(NSDictionary *)clusteringResults {
    if (clusteringResults) {
        float *reducedData =
            [(NSValue *)clusteringResults[@"reducedData"] pointerValue];

        if (reducedData) {
            free(reducedData);
        }

        for (NSValue *value in clusteringResults[@"allLabels"]) {
            int *pointer = [value pointerValue];
            if (pointer) free(pointer);
        }

        for (NSValue *value in clusteringResults[@"allCentroids"]) {
            float *pointer = [value pointerValue];
            if (pointer) free(pointer);
        }

        for (NSValue *value in clusteringResults[@"allClusterSilhouetteScores"]) {
            float *pointer = [value pointerValue];
            if (pointer) free(pointer);
        }

        for (NSValue *value in clusteringResults[@"allSilhouetteScores"]) {
            float *pointer = [value pointerValue];
            if (pointer) free(pointer);
        }

        for (NSValue *value in clusteringResults[@"allClusterCounts"]) {
            int *pointer = [value pointerValue];
            if (pointer) free(pointer);
        }
    }

    NSLog(@"Clustering data freed");
}

- (NSDictionary *)performKMeansWithSilhouetteScoring:(float *)data
                                                rows:(int)rows
                                                cols:(int)cols
                                                minK:(int)minK
                                                maxK:(int)maxK
                                       maxIterations:(int)maxIterations {
    // For very small datasets, return a single cluster
    if (rows <= 4) {
        int bestK = 1;

        float *bestCentroids = malloc(cols * sizeof(float));
        int *bestLabels = malloc(rows * sizeof(int));
        int *bestClusterCounts = malloc(sizeof(int));

        bestClusterCounts[0] = rows;

        // Calculate the mean of each feature
        for (int j = 0; j < cols; ++j) {
            float sum = 0.0f;

            for (int i = 0; i < rows; ++i) {
                sum += data[i * cols + j];
            }

            bestCentroids[j] = sum / rows;
        }

        // Assign every point to cluster zero
        for (int i = 0; i < rows; ++i) {
            bestLabels[i] = 0;
        }

        float *silhouetteScoresArray = malloc(rows * sizeof(float));

        for (int i = 0; i < rows; ++i) {
            silhouetteScoresArray[i] = 1.0f;
        }

        float *clusterSilhouetteScoresArray = malloc(sizeof(float));
        clusterSilhouetteScoresArray[0] = 1.0f;

        NSMutableArray *labelsArray = [NSMutableArray arrayWithObject:
            [NSValue valueWithPointer:bestLabels]];

        NSMutableArray *centroidsArray = [NSMutableArray arrayWithObject:
            [NSValue valueWithPointer:bestCentroids]];

        NSMutableArray *allClusterSilhouetteScores = [NSMutableArray arrayWithObject:
            [NSValue valueWithPointer:clusterSilhouetteScoresArray]];

        NSMutableArray *allSilhouetteScores = [NSMutableArray arrayWithObject:
            [NSValue valueWithPointer:silhouetteScoresArray]];

        NSMutableArray *clusterCountsArray = [NSMutableArray arrayWithObject:
            [NSValue valueWithPointer:bestClusterCounts]];

        return @{
            @"bestK": @(bestK),
            @"bestScore": @(1.0f),
            @"bestLabels": [NSValue valueWithPointer:bestLabels],
            @"bestCentroids": [NSValue valueWithPointer:bestCentroids],
            @"bestClusterCounts": [NSValue valueWithPointer:bestClusterCounts],
            @"allLabels": labelsArray,
            @"allCentroids": centroidsArray,
            @"allClusterSilhouetteScores": allClusterSilhouetteScores,
            @"allSilhouetteScores": allSilhouetteScores,
            @"allClusterCounts": clusterCountsArray
        };
    }

    float bestScore = -FLT_MAX;
    int bestK = minK;

    int *bestLabels = NULL;
    float *bestCentroids = NULL;
    int *bestClusterCounts = NULL;

    NSMutableArray *allLabels = [NSMutableArray array];
    NSMutableArray *allCentroids = [NSMutableArray array];
    NSMutableArray *allClusterSilhouetteScores = [NSMutableArray array];
    NSMutableArray *allSilhouetteScores = [NSMutableArray array];
    NSMutableArray *allClusterCounts = [NSMutableArray array];

    for (int k = minK; k <= maxK; ++k) {
        int *labels = malloc(rows * sizeof(int));
        float *centroids = malloc(k * cols * sizeof(float));

        [self performKMeansClustering:data
                                 rows:rows
                                 cols:cols
                                    k:k
                       maxIterations:maxIterations
                               labels:labels
                            centroids:centroids];

        NSDictionary *silhouetteResult =
            [self calculateSilhouetteScore:data
                                    labels:labels
                                      rows:rows
                                      cols:cols
                                          k:k];

        float averageSilhouetteScore =
            [silhouetteResult[@"averageSilhouetteScore"] floatValue];

        float *clusterSilhouetteScores =
            [silhouetteResult[@"clusterSilhouetteScores"] pointerValue];

        float *silhouetteScoresArray =
            [silhouetteResult[@"silhouetteScores"] pointerValue];

        int *clusterCounts =
            [silhouetteResult[@"clusterCounts"] pointerValue];

        [allLabels addObject:[NSValue valueWithPointer:labels]];
        [allCentroids addObject:[NSValue valueWithPointer:centroids]];
        [allClusterSilhouetteScores addObject:
            [NSValue valueWithPointer:clusterSilhouetteScores]];
        [allSilhouetteScores addObject:
            [NSValue valueWithPointer:silhouetteScoresArray]];
        [allClusterCounts addObject:[NSValue valueWithPointer:clusterCounts]];

        // Select the k with the highest average silhouette score
        if (averageSilhouetteScore > bestScore) {
            bestScore = averageSilhouetteScore;
            bestK = k;
            bestLabels = labels;
            bestCentroids = centroids;
            bestClusterCounts = clusterCounts;
        }
    }

    return @{
        @"bestK": @(bestK),
        @"bestScore": @(bestScore),
        @"bestLabels": [NSValue valueWithPointer:bestLabels],
        @"bestCentroids": [NSValue valueWithPointer:bestCentroids],
        @"bestClusterCounts": [NSValue valueWithPointer:bestClusterCounts],
        @"allLabels": allLabels,
        @"allCentroids": allCentroids,
        @"allClusterSilhouetteScores": allClusterSilhouetteScores,
        @"allSilhouetteScores": allSilhouetteScores,
        @"allClusterCounts": allClusterCounts
    };
}

- (NSDictionary *)calculateSilhouetteScore:(float *)data
                                    labels:(int *)labels
                                      rows:(int)rows
                                      cols:(int)cols
                                          k:(int)k {
    float *a = malloc(rows * sizeof(float));
    float *b = malloc(rows * sizeof(float));
    float *silhouetteScores = malloc(rows * sizeof(float));
    float *clusterSilhouetteScores = malloc(k * sizeof(float));
    int *clusterCounts = malloc(k * sizeof(int));

    memset(clusterSilhouetteScores, 0, k * sizeof(float));
    memset(clusterCounts, 0, k * sizeof(int));

    for (int i = 0; i < rows; ++i) {
        float intraClusterDist = 0.0f;
        int intraClusterCount = 0;

        float *interClusterDists = malloc(k * sizeof(float));
        int *interClusterCounts = malloc(k * sizeof(int));

        memset(interClusterDists, 0, k * sizeof(float));
        memset(interClusterCounts, 0, k * sizeof(int));

        for (int j = 0; j < rows; ++j) {
            if (i == j) continue;

            float dist = 0.0f;

            for (int l = 0; l < cols; ++l) {
                float diff = data[i * cols + l] - data[j * cols + l];
                dist += diff * diff;
            }

            dist = sqrtf(dist);

            if (labels[i] == labels[j]) {
                intraClusterDist += dist;
                intraClusterCount++;
            } else {
                interClusterDists[labels[j]] += dist;
                interClusterCounts[labels[j]]++;
            }
        }

        a[i] = intraClusterCount > 0
            ? intraClusterDist / intraClusterCount
            : 0.0f;

        float minInterClusterDist = FLT_MAX;

        for (int j = 0; j < k; ++j) {
            if (j != labels[i] && interClusterCounts[j] > 0) {
                float meanDist =
                    interClusterDists[j] / interClusterCounts[j];

                if (meanDist < minInterClusterDist) {
                    minInterClusterDist = meanDist;
                }
            }
        }

        b[i] = minInterClusterDist;

        free(interClusterDists);
        free(interClusterCounts);
    }

    float silhouetteSum = 0.0f;

    for (int i = 0; i < rows; ++i) {
        float denominator = fmaxf(a[i], b[i]);
        float s = denominator > 0.0f
            ? (b[i] - a[i]) / denominator
            : 0.0f;

        silhouetteScores[i] = s;
        silhouetteSum += s;
        clusterSilhouetteScores[labels[i]] += s;
        clusterCounts[labels[i]]++;
    }

    for (int i = 0; i < k; ++i) {
        if (clusterCounts[i] > 0) {
            clusterSilhouetteScores[i] /= clusterCounts[i];
        }
    }

    float averageSilhouetteScore = silhouetteSum / rows;

    NSDictionary *result = @{
        @"averageSilhouetteScore": @(averageSilhouetteScore),
        @"clusterSilhouetteScores": [NSValue valueWithPointer:clusterSilhouetteScores],
        @"silhouetteScores": [NSValue valueWithPointer:silhouetteScores],
        @"clusterCounts": [NSValue valueWithPointer:clusterCounts]
    };

    free(a);
    free(b);

    return result;
}

- (void)performKMeansClustering:(float *)data
                           rows:(int)rows
                           cols:(int)cols
                              k:(int)k
                 maxIterations:(int)maxIterations
                         labels:(int *)labels
                      centroids:(float *)centroids {
    // Deterministically initialize centroids by evenly sampling data points.
    // This replaces random initialization with repeatable initialization.
    for (int i = 0; i < k; ++i) {
        int index = i * rows / k;

        for (int j = 0; j < cols; ++j) {
            centroids[i * cols + j] = data[index * cols + j];
        }
    }

    int *counts = malloc(k * sizeof(int));
    float *sums = malloc(k * cols * sizeof(float));

    for (int iter = 0; iter < maxIterations; ++iter) {
        memset(counts, 0, k * sizeof(int));
        memset(sums, 0, k * cols * sizeof(float));

        // Assign each point to its nearest centroid
        for (int i = 0; i < rows; ++i) {
            float minDist = FLT_MAX;
            int bestCluster = 0;

            for (int j = 0; j < k; ++j) {
                float dist = 0.0f;

                for (int l = 0; l < cols; ++l) {
                    float diff =
                        data[i * cols + l] - centroids[j * cols + l];

                    dist += diff * diff;
                }

                if (dist < minDist) {
                    minDist = dist;
                    bestCluster = j;
                }
            }

            labels[i] = bestCluster;
            counts[bestCluster]++;

            for (int l = 0; l < cols; ++l) {
                sums[bestCluster * cols + l] += data[i * cols + l];
            }
        }

        // Update centroids
        for (int j = 0; j < k; ++j) {
            if (counts[j] == 0) continue;

            for (int l = 0; l < cols; ++l) {
                centroids[j * cols + l] =
                    sums[j * cols + l] / counts[j];
            }
        }
    }

    free(counts);
    free(sums);
}

- (void)performPCA:(float *)data
              rows:(int)rows
              cols:(int)cols
            output:(float *)output
         outputDim:(int)outputDim {
    float *centeredData = malloc(rows * cols * sizeof(float));
    memcpy(centeredData, data, rows * cols * sizeof(float));

    float *mean = malloc(cols * sizeof(float));

    // Calculate the mean of each feature
    for (int j = 0; j < cols; ++j) {
        vDSP_meanv(&data[j], cols, &mean[j], rows);
    }

    // Center each row
    for (int i = 0; i < rows; ++i) {
        vDSP_vsub(mean, 1, &centeredData[i * cols], 1,
                  &centeredData[i * cols], 1, cols);
    }

    // Transpose the centered data to column-major order
    float *centeredDataColMajor = malloc(rows * cols * sizeof(float));
    vDSP_mtrans(centeredData, 1, centeredDataColMajor, 1, cols, rows);

    // Allocate SVD matrices
    float *U = malloc(rows * rows * sizeof(float));
    float *S = malloc(MIN(rows, cols) * sizeof(float));
    float *VT = malloc(cols * cols * sizeof(float));

    int lrows = rows;
    int lcols = cols;
    int lda = rows;
    int ldu = rows;
    int ldvt = cols;
    int info;
    int lwork = -1;
    float wkopt;

    // Query optimal workspace size
    sgesvd_("A", "A", &lrows, &lcols, centeredDataColMajor,
            &lda, S, U, &ldu, VT, &ldvt, &wkopt, &lwork, &info);

    lwork = (int)wkopt;
    float *work = malloc(lwork * sizeof(float));

    // Perform SVD
    sgesvd_("A", "A", &lrows, &lcols, centeredDataColMajor,
            &lda, S, U, &ldu, VT, &ldvt, work, &lwork, &info);

    if (info > 0) {
        NSLog(@"The algorithm computing SVD failed to converge.");

        free(mean);
        free(U);
        free(S);
        free(VT);
        free(work);
        free(centeredData);
        free(centeredDataColMajor);

        return;
    }

    NSLog(@"S Vector:");

    for (int i = 0; i < MIN(rows, cols); ++i) {
        NSLog(@"%f", S[i]);
    }

    float *outputColumnMajor = malloc(rows * outputDim * sizeof(float));
    float *outputColumnMajorNormalized =
        malloc(rows * outputDim * sizeof(float));

    // Select the first outputDim columns of U
    for (int i = 0; i < rows; ++i) {
        for (int j = 0; j < outputDim; ++j) {
            outputColumnMajor[j * rows + i] = U[j * rows + i];
        }
    }

    // Normalize each dimension to [-1, 1]
    for (int j = 0; j < outputDim; ++j) {
        float minVal;
        float maxVal;

        vDSP_minv(&outputColumnMajor[j * rows], 1, &minVal, rows);
        vDSP_maxv(&outputColumnMajor[j * rows], 1, &maxVal, rows);

        float range = maxVal - minVal;

        if (range > 0.0f) {
            float scale = 2.0f / range;
            float offset = -(minVal + maxVal) / range;

            vDSP_vsmsa(&outputColumnMajor[j * rows], 1,
                       &scale, &offset,
                       &outputColumnMajorNormalized[j * rows], 1, rows);
        } else {
            float zero = 0.0f;

            vDSP_vfill(&zero,
                       &outputColumnMajorNormalized[j * rows], 1, rows);
        }
    }

    // Transpose normalized data back to row-major order
    vDSP_mtrans(outputColumnMajorNormalized, 1, output, 1,
                rows, outputDim);

    free(outputColumnMajor);
    free(outputColumnMajorNormalized);
    free(mean);
    free(U);
    free(S);
    free(VT);
    free(work);
    free(centeredData);
    free(centeredDataColMajor);
}

- (NSMutableArray *)fit3DGaussianAndGetEllipsoid:(float *)reducedData
                                            rows:(int)rows
                                          labels:(int *)labels
                                     numClusters:(int)numClusters
                                      reducedDim:(int)reducedDim
                                    clusterCounts:(int *)clusterCounts {
    NSMutableArray *ellipsoids =
        [NSMutableArray arrayWithCapacity:numClusters];

    for (int i = 0; i < numClusters; ++i) {
        int clusterSize = clusterCounts[i];

        float *clusterPoints =
            malloc(clusterSize * reducedDim * sizeof(float));

        int index = 0;

        for (int j = 0; j < rows; ++j) {
            if (labels[j] == i) {
                memcpy(&clusterPoints[index * reducedDim],
                       &reducedData[j * reducedDim],
                       reducedDim * sizeof(float));

                index++;
            }
        }

        NSDictionary *ellipsoid =
            [self fitSingle3DGaussian:clusterPoints size:clusterSize];

        [ellipsoids addObject:ellipsoid];

        free(clusterPoints);
    }

    return ellipsoids;
}

- (NSDictionary *)fitSingle3DGaussian:(float *)clusterPoints size:(int)n {
    float mean[3] = {0.0f, 0.0f, 0.0f};

    // Calculate the mean of each column
    for (int j = 0; j < 3; ++j) {
        vDSP_meanv(&clusterPoints[j], 3, &mean[j], n);
    }

    float *centeredData = malloc(n * 3 * sizeof(float));

    for (int i = 0; i < n; ++i) {
        centeredData[i * 3] = clusterPoints[i * 3] - mean[0];
        centeredData[i * 3 + 1] = clusterPoints[i * 3 + 1] - mean[1];
        centeredData[i * 3 + 2] = clusterPoints[i * 3 + 2] - mean[2];
    }

    // Transpose centered data
    float *centeredDataTransposed = malloc(n * 3 * sizeof(float));

    vDSP_mtrans(centeredData, 1, centeredDataTransposed, 1, 3, n);

    float covariance[3][3] = {0.0f};

    // Compute covariance matrix
    vDSP_mmul(centeredDataTransposed, 1, centeredData, 1,
              (float *)covariance, 1, 3, 3, n);

    float scale = n > 1 ? 1.0f / (n - 1) : 0.0f;

    vDSP_vsmul((float *)covariance, 1, &scale,
               (float *)covariance, 1, 9);

    free(centeredData);
    free(centeredDataTransposed);

    float covarianceCopy[3][3];
    memcpy(covarianceCopy, covariance, sizeof(float) * 9);

    float eigenvalues[3];
    float U[3][3];
    float VT[3][3];

    int n_ = 3;
    int info;
    int lwork = -1;
    float wkopt;

    sgesvd_("A", "A", &n_, &n_, (float *)covarianceCopy, &n_,
            eigenvalues, (float *)U, &n_, (float *)VT, &n_,
            &wkopt, &lwork, &info);

    lwork = (int)wkopt;
    float *work = malloc(lwork * sizeof(float));

    sgesvd_("A", "A", &n_, &n_, (float *)covarianceCopy, &n_,
            eigenvalues, (float *)U, &n_, (float *)VT, &n_,
            work, &lwork, &info);

    free(work);

    if (info > 0) {
        NSLog(@"The algorithm computing SVD failed to converge.");
        return @{};
    }

    float determinant =
        covariance[0][0] *
            (covariance[1][1] * covariance[2][2] -
             covariance[1][2] * covariance[2][1]) -
        covariance[0][1] *
            (covariance[1][0] * covariance[2][2] -
             covariance[1][2] * covariance[2][0]) +
        covariance[0][2] *
            (covariance[1][0] * covariance[2][1] -
             covariance[1][1] * covariance[2][0]);

    NSDictionary *ellipsoid = @{
        @"mean": @[@(mean[0]), @(mean[1]), @(mean[2])],
        @"eigenvalues": @[@(eigenvalues[0]), @(eigenvalues[1]), @(eigenvalues[2])],
        @"eigenvectors": @[
            @[@(U[0][0]), @(U[1][0]), @(U[2][0])],
            @[@(U[0][1]), @(U[1][1]), @(U[2][1])],
            @[@(U[0][2]), @(U[1][2]), @(U[2][2])]
        ],
        @"covariance": @[
            @[@(covariance[0][0]), @(covariance[0][1]), @(covariance[0][2])],
            @[@(covariance[1][0]), @(covariance[1][1]), @(covariance[1][2])],
            @[@(covariance[2][0]), @(covariance[2][1]), @(covariance[2][2])]
        ],
        @"determinant": @(determinant)
    };

    return ellipsoid;
}

+ (NSDictionary *)decompose2x2:(float[2][2])covarianceMatrix {
    float covarianceCopy[2][2];
    memcpy(covarianceCopy, covarianceMatrix, sizeof(float) * 4);

    float eigenvalues[2];
    float U[2][2];
    float VT[2][2];

    int n_ = 2;
    int info;
    int lwork = -1;
    float wkopt;

    sgesvd_("A", "A", &n_, &n_, (float *)covarianceCopy, &n_,
            eigenvalues, (float *)U, &n_, (float *)VT, &n_,
            &wkopt, &lwork, &info);

    lwork = (int)wkopt;
    float *work = malloc(lwork * sizeof(float));

    sgesvd_("A", "A", &n_, &n_, (float *)covarianceCopy, &n_,
            eigenvalues, (float *)U, &n_, (float *)VT, &n_,
            work, &lwork, &info);

    free(work);

    if (info > 0) {
        NSLog(@"The algorithm computing SVD failed to converge.");
        return @{};
    }

    float determinant =
        covarianceMatrix[0][0] * covarianceMatrix[1][1] -
        covarianceMatrix[0][1] * covarianceMatrix[1][0];

    return @{
        @"eigenvalues": @[@(eigenvalues[0]), @(eigenvalues[1])],
        @"eigenvectors": @[
            @[@(U[0][0]), @(U[1][0])],
            @[@(U[0][1]), @(U[1][1])]
        ],
        @"determinant": @(determinant)
    };
}

+ (NSDictionary *)decompose3x3:(float[3][3])covarianceMatrix {
    float covarianceCopy[3][3];
    memcpy(covarianceCopy, covarianceMatrix, sizeof(float) * 9);

    float eigenvalues[3];
    float U[3][3];
    float VT[3][3];

    int n_ = 3;
    int info;
    int lwork = -1;
    float wkopt;

    sgesvd_("A", "A", &n_, &n_, (float *)covarianceCopy, &n_,
            eigenvalues, (float *)U, &n_, (float *)VT, &n_,
            &wkopt, &lwork, &info);

    lwork = (int)wkopt;
    float *work = malloc(lwork * sizeof(float));

    sgesvd_("A", "A", (float *)&n_, (float *)&n_,
            (float *)covarianceCopy, &n_,
            eigenvalues, (float *)U, &n_, (float *)VT, &n_,
            work, &lwork, &info);

    free(work);

    if (info > 0) {
        NSLog(@"The algorithm computing SVD failed to converge.");
        return @{};
    }

    float determinant =
        covarianceMatrix[0][0] *
            (covarianceMatrix[1][1] * covarianceMatrix[2][2] -
             covarianceMatrix[1][2] * covarianceMatrix[2][1]) -
        covarianceMatrix[0][1] *
            (covarianceMatrix[1][0] * covarianceMatrix[2][2] -
             covarianceMatrix[1][2] * covarianceMatrix[2][0]) +
        covarianceMatrix[0][2] *
            (covarianceMatrix[1][0] * covarianceMatrix[2][1] -
             covarianceMatrix[1][1] * covarianceMatrix[2][0]);

    return @{
        @"eigenvalues": @[@(eigenvalues[0]), @(eigenvalues[1]), @(eigenvalues[2])],
        @"eigenvectors": @[
            @[@(U[0][0]), @(U[1][0]), @(U[2][0])],
            @[@(U[0][1]), @(U[1][1]), @(U[2][1])],
            @[@(U[0][2]), @(U[1][2]), @(U[2][2])]
        ],
        @"determinant": @(determinant)
    };
}

+ (float)getVarianceAlongDirection:(float[3])direction
                  covarianceMatrix:(float[3][3])covarianceMatrix {
    float variance = 0.0f;

    for (int i = 0; i < 3; i++) {
        float rowDotProduct = 0.0f;

        for (int j = 0; j < 3; j++) {
            rowDotProduct += covarianceMatrix[i][j] * direction[j];
        }

        variance += direction[i] * rowDotProduct;
    }

    return variance;
}

@end
