import Foundation
import CoreML

@objc(TextFeatureExtractor)
class TextFeatureExtractor: NSObject {
    private let bertModel: all_MiniLM_L6_v2_coreml_float32
    private let vocab: [String: Int]
    private let tokenizer: BertTokenizer
    private let windowSize = 15  // Define the window size as a constant
  
    // React Native requires this to be exposed for initialization checks
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override init() {
        // Load the CoreML model
        let config = MLModelConfiguration()
        self.bertModel = try! all_MiniLM_L6_v2_coreml_float32(configuration: config)
        
        // Path to vocab.txt in the main bundle
        if let vocabPath = Bundle.main.path(forResource: "MiniLM-vocab", ofType: "txt") {
            do {
                // Load the contents of the file
                let vocabString = try String(contentsOfFile: vocabPath, encoding: .utf8)
                
                // Split the string into lines and enumerate them to create a dictionary
                let lines = vocabString.components(separatedBy: .newlines)
                self.vocab = Dictionary(uniqueKeysWithValues: lines.enumerated().filter { !$0.element.isEmpty }.map { ($0.element, $0.offset) })
            } catch {
                fatalError("Unable to load vocab.txt: \(error)")
            }
        } else {
            fatalError("vocab.txt not found in the main bundle.")
        }
      
      self.tokenizer = BertTokenizer(vocab: self.vocab)
    }

    @objc(extractFeatures:resolver:rejecter:)
    func extractFeatures(fromText text: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        // Preprocess and tokenize the text
        let tokenizedOutput = tokenizer.tokenizeToIds(text: text)
        guard let inputIdsMultiArray = try? MLMultiArray(shape: [1, 512], dataType: .float32),
              let attentionMaskMultiArray = try? MLMultiArray(shape: [1, 512], dataType: .float32) else {
            rejecter("MLMULTIARRAY_ERROR", "Could not create MLMultiArrays.", nil)
            return
        }

        // Fill in the input IDs and attention mask arrays
        for i in 0..<512 {
            let index = i < tokenizedOutput.count ? tokenizedOutput[i] : tokenizer.padTokenId
            inputIdsMultiArray[i] = NSNumber(value: index)
            attentionMaskMultiArray[i] = NSNumber(value: i < tokenizedOutput.count ? 1 : 0)
        }
      
        //        checkInputValues(inputIds: inputIdsMultiArray, attentionMask: attentionMaskMultiArray)

        // Assume your model has an initializer like this (verify the exact names):
        let modelInput = all_MiniLM_L6_v2_coreml_float32Input(input_ids: inputIdsMultiArray, attention_mask: attentionMaskMultiArray)

        // Perform the prediction
        guard let predictionOutput = try? bertModel.prediction(input: modelInput),
              let hiddenStates = predictionOutput.featureValue(for: "hidden_states")?.multiArrayValue else {
            rejecter("MODEL_PREDICTION_ERROR", "Failed to perform prediction with the Core ML model", nil)	
            return
        }
      
        // Assuming hiddenStates.shape = [1, 512, 384]
        //        let sequenceLength = hiddenStates.shape[1].intValue
        //        let embeddingSize = hiddenStates.shape[2].intValue
                // Example: Print the first 10 embeddings for the first 5 tokens
        //        for i in 0..<5 { // Tokens
        //            print("Token \(i):")
        //            for j in 0..<10 { // Embeddings for each token
        //                let index = i * embeddingSize + j // Calculate the correct index
        //                let value = hiddenStates[index].floatValue // Get the value at the calculated index
        //                print("  Embedding \(j): \(value)")
        //            }
        //        }

        let features = meanPooling(hiddenStates: hiddenStates, attentionMask: attentionMaskMultiArray)
        let normalizedFeatures = normalizeVector(features)

        // Resolve the promise with the features
        resolver(normalizedFeatures)
    }
  
    // Assuming inputIdsMultiArray and attentionMaskMultiArray have been properly initialized and populated
    //    func checkInputValues(inputIds: MLMultiArray, attentionMask: MLMultiArray) {
    //        print("Checking input IDs:")
    //        for i in 0..<10 {
    //            let value = inputIds[i].intValue // Assuming these are integer values
    //            print("Input ID at index \(i): \(value)")
    //            // Optionally, add a condition to check for unexpected values
    //            if value < 0 || value > vocab.count { // Example condition, adjust based on your model's expected input range
    //                print("Warning: Unexpected value at index \(i): \(value)")
    //            }
    //        }
    //
    //        print("Checking attention mask:")
    //        for i in 0..<10 {
    //            let value = attentionMask[i].intValue // Assuming these are integer values
    //            print("Attention mask at index \(i): \(value)")
    //            // Optionally, add a condition to check for unexpected values
    //            if value != 0 && value != 1 { // Attention mask values are expected to be 0 or 1
    //                print("Warning: Unexpected value at index \(i): \(value)")
    //            }
    //        }
    //    }

    private func meanPooling(hiddenStates: MLMultiArray, attentionMask: MLMultiArray) -> [Float] {
        let sequenceLength = hiddenStates.shape[1].intValue
        let embeddingSize = hiddenStates.shape[2].intValue
        var sumVectors = Array(repeating: Float(0), count: embeddingSize)
        var validTokenCount: Float = 0
        
        for i in 0..<sequenceLength {
            if attentionMask[i].intValue == 1 { // Consider only tokens with attention mask = 1
                validTokenCount += 1
                for j in 0..<embeddingSize {
                    let index = i * embeddingSize + j
                    sumVectors[j] += hiddenStates[index].floatValue
                }
            }
        }
        
        guard validTokenCount > 0 else { return sumVectors }
        return sumVectors.map { $0 / validTokenCount } // Mean pooling
    }
  
    private func normalizeVector(_ vector: [Float]) -> [Float] {
        let norm = l2Norm(vector)
        guard norm > 0 else { return vector }
        return vector.map { $0 / norm }
    }
  
    private func l2Norm(_ vector: [Float]) -> Float {
        return sqrt(vector.reduce(0) { sum, element in sum + element * element })
    }
    
    // Placeholder for converting emojis to text representation
    private func convertEmojisToText(_ text: String) -> String {
        // Convert emojis to a text representation
        // e.g., "🤗" -> ":hugging_face:"
        // You can use a pre-built library or a custom mapping for emojis
      return text
    }
  
    // New React Native exposed method to chunk text and perform clustering
    @objc(chunkText:resolver:rejecter:)
    func chunkText(text: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        print("text: \(text)") // Debug print to check the model path
      
        // Generate sentences
        let sentences = textToSentences(text: text)
      
        print("sentences: \(sentences)") // Debug print to check the model path

        // Generate embeddings for each tokenized chunk
        let embeddings = generateEmbeddings(windows: sentences)
      
        print("embeddings:") // Debug print to check the model path
        for embedding in embeddings {
            print(embedding)
        }

        // Determine the optimal number of clusters
        let optimalK = determineOptimalClusters(embeddings: embeddings)

        // Perform K-means clustering
        let (centroids, labels) = performKMeansClustering(embeddings: embeddings, k: optimalK)

        // Group the text windows by their cluster labels, removing duplicates
        var clusters: [Int: String] = [:]
        var lastLabel: Int? = nil
        var lastIndex: Int = 0

        for (index, label) in labels.enumerated() {
            if label != lastLabel {
                if lastLabel != nil {
                    let startIndex = lastIndex // Start from lastIndex
                    let endIndex = index < sentences.count ? index : sentences.count
                    clusters[lastLabel!] = sentences[startIndex..<endIndex].joined(separator: " ")
                }
                lastIndex = index
                lastLabel = label
            }
        }
        if let lastLabel = lastLabel {
            let startIndex = lastIndex
            clusters[lastLabel] = sentences[startIndex...].joined(separator: " ")
        }

        // Prepare the result
        var result: [[String: Any]] = []
        for (label, centroid) in centroids.enumerated() {
            result.append([
                "centroid": centroid,
                "text": clusters[label] ?? ""
            ])
        }

        // Resolve the promise with the result
        resolver(result)
    }
  
    // New method to tokenize text using sliding window approach
    private func textToSentences(text: String) -> [String] {
        let pattern = #"(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?)\s"# // Regex pattern to split by sentence
        let sentences = text.split(whereSeparator: { $0.isNewline || String($0).range(of: pattern, options: .regularExpression) != nil }).map { String($0) }
        return sentences
    }

    // New method to generate embeddings for each tokenized chunk
    private func generateEmbeddings(windows: [String]) -> [[Float]] {
        var embeddings: [[Float]] = []

        for text in windows {
            let tokenizedOutput = tokenizer.tokenizeToIds(text: text)
            guard let inputIdsMultiArray = try? MLMultiArray(shape: [1, 512], dataType: .float32),
                  let attentionMaskMultiArray = try? MLMultiArray(shape: [1, 512], dataType: .float32) else {
                continue
            }

            for i in 0..<512 {
                let index = i < tokenizedOutput.count ? tokenizedOutput[i] : tokenizer.padTokenId
                inputIdsMultiArray[i] = NSNumber(value: index)
                attentionMaskMultiArray[i] = NSNumber(value: i < tokenizedOutput.count ? 1 : 0)
            }

            let modelInput = all_MiniLM_L6_v2_coreml_float32Input(input_ids: inputIdsMultiArray, attention_mask: attentionMaskMultiArray)
            guard let predictionOutput = try? bertModel.prediction(input: modelInput),
                  let hiddenStates = predictionOutput.featureValue(for: "hidden_states")?.multiArrayValue else {
                continue
            }

            let features = meanPooling(hiddenStates: hiddenStates, attentionMask: attentionMaskMultiArray)
            embeddings.append(features)
        }

        return embeddings
    }
  
    // New method to determine the optimal number of clusters using the Elbow Method
    private func determineOptimalClusters(embeddings: [[Float]]) -> Int {
        let maxK = min(10, embeddings.count) // Maximum number of clusters to consider
        var sse = [Float](repeating: 0.0, count: maxK) // Array to store SSE values for each k

        for k in 1...maxK {
            let kMeans = KMeans(data: embeddings, k: k) // Initialize K-means with k clusters
            kMeans.fit() // Fit the K-means model to the embeddings
            sse[k - 1] = kMeans.sse() // Store the SSE for k clusters
        }

        let optimalK = findKUsingLMethod(sse: sse)
        return optimalK
    }
  
    // New method to perform K-means clustering
    private func performKMeansClustering(embeddings: [[Float]], k: Int) -> ([[Float]], [Int]) {
        let kMeans = KMeans(data: embeddings, k: k)
        kMeans.fit()
        return (kMeans.centroids, kMeans.labels)
    }
  
    // L-method implementation
    private func findKUsingLMethod(sse: [Float]) -> Int {
        let n = sse.count
        guard n > 1 else { return 1 }
        
        // Split SSE array into two halves
        var left = Array(sse[0..<(n / 2)])
        var right = Array(sse[(n / 2)..<n])
        
        var bestFitness = fitnessScore(left: left, right: right)
        var improved = true

        while improved {
            improved = false
            // Try moving the last point of the left array to the start of the right array
            if left.count > 1 {
                right.insert(left.removeLast(), at: 0)
                let newFitness = fitnessScore(left: left, right: right)
                if newFitness > bestFitness {
                    bestFitness = newFitness
                    improved = true
                } else {
                    // Undo the move if it did not improve the fitness
                    left.append(right.removeFirst())
                }
            }

            // Try moving the first point of the right array to the end of the left array
            if !improved && right.count > 1 {
                left.append(right.removeFirst())
                let newFitness = fitnessScore(left: left, right: right)
                if newFitness > bestFitness {
                    bestFitness = newFitness
                    improved = true
                } else {
                    // Undo the move if it did not improve the fitness
                    right.insert(left.removeLast(), at: 0)
                }
            }
        }

        // Find the intersection point of the two lines
        print("left: \(left)")
        print("right: \(right)")
      
        let leftLine = linearRegression(data: left)
        let rightLine = linearRegression(data: right, offset: left.count)
        let intersectionIndex = findIntersection(leftLine: leftLine, rightLine: rightLine, leftCount: left.count)
        
        return intersectionIndex
    }
  
    private func fitnessScore(left: [Float], right: [Float]) -> Float {
        let leftFit = linearFitError(data: left)
        let rightFit = linearFitError(data: right)
        return leftFit + rightFit
    }
  
    private func linearFitError(data: [Float]) -> Float {
        guard data.count > 1 else { return Float.greatestFiniteMagnitude }
        
        let n = Float(data.count)
        let xMean = n / 2.0
        let yMean = data.reduce(0, +) / n
        var num: Float = 0.0
        var denom: Float = 0.0
        
        for i in 0..<data.count {
            let x = Float(i)
            let y = data[i]
            num += (x - xMean) * (y - yMean)
            denom += (x - xMean) * (x - xMean)
        }
        
        let slope = num / denom
        let intercept = yMean - slope * xMean
        var error: Float = 0.0
        
        for i in 0..<data.count {
            let x = Float(i)
            let y = data[i]
            let yFit = slope * x + intercept
            error += (y - yFit) * (y - yFit)
        }
        
        return error
    }
  
    private func linearRegression(data: [Float], offset: Int = 0) -> (slope: Float, intercept: Float) {
        guard data.count > 1 else {
            return (0, data.first ?? 0)
        }
      
        let n = Float(data.count)
        let xMean = (n - 1) / 2.0 + Float(offset)
        let yMean = data.reduce(0, +) / n
        var num: Float = 0.0
        var denom: Float = 0.0

        for i in 0..<data.count {
            let x = Float(i + offset)
            let y = data[i]
            num += (x - xMean) * (y - yMean)
            denom += (x - xMean) * (x - xMean)
        }

        let slope = num / denom
        let intercept = yMean - slope * xMean
        return (slope, intercept)
    }

    private func findIntersection(leftLine: (slope: Float, intercept: Float), rightLine: (slope: Float, intercept: Float), leftCount: Int) -> Int {
        let (slope1, intercept1) = leftLine
        let (slope2, intercept2) = rightLine
        print("slope1: \(slope1)")
        print("slope2: \(slope2)")
        print("intercept1: \(intercept1)")
        print("intercept2: \(intercept2)")
        
        let intersectionX = (intercept2 - intercept1) / (slope1 - slope2)
        return max(0, min(leftCount, Int(intersectionX.rounded())))
    }
}

// K-means clustering implementation
class KMeans {
    var centroids: [[Float]]
    var labels: [Int]
    private let k: Int
    private var data: [[Float]]

    init(data: [[Float]], k: Int) {
        self.data = data
        self.k = k
        self.centroids = []
        self.labels = Array(repeating: -1, count: data.count)
    }

    func fit() {
        let n = data.count
        let d = data[0].count

        // Initialize centroids as random points from the data
        centroids = (0..<k).map { _ in data[Int.random(in: 0..<n)] }

        var oldLabels: [Int] = []
        repeat {
            oldLabels = labels

            // Assign each point to the nearest centroid
            labels = data.map { point in
                centroids.enumerated().min(by: { distance($0.element, point) < distance($1.element, point) })!.offset
            }

            // Update centroids
            centroids = (0..<k).map { clusterIndex in
                let clusterPoints = data.enumerated().filter { labels[$0.offset] == clusterIndex }.map { $0.element }
                guard !clusterPoints.isEmpty else { return centroids[clusterIndex] }
                return mean(clusterPoints)
            }
        } while labels != oldLabels
    }

    func sse() -> Float {
        return (0..<k).reduce(0) { sse, clusterIndex in
            let clusterPoints = data.enumerated().filter { labels[$0.offset] == clusterIndex }.map { $0.element }
            return sse + clusterPoints.reduce(0) { sum, point in
                sum + distance(point, centroids[clusterIndex])
            }
        }
    }

    private func distance(_ a: [Float], _ b: [Float]) -> Float {
        return zip(a, b).reduce(0) { sum, pair in
            let (x, y) = pair
            return sum + (x - y) * (x - y)
        }
    }

    private func mean(_ points: [[Float]]) -> [Float] {
        let n = Float(points.count)
        let d = points[0].count
        return (0..<d).map { i in points.reduce(0) { sum, point in sum + point[i] } / n }
    }
}
