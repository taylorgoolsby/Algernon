import Foundation
import MLX
import MLXRandom
import Tokenizers
import React

@objc(LLMNativeModule)
class LLMNativeModule: RCTEventEmitter {
    let tokenizer = CodeGenTokenizer()
    
    // This is required by the RCTBridgeModule protocol
    override static func moduleName() -> String! {
        return "LLMNativeModule"
    }

    // This optional method allows the module to be initialized without requiring the bridge
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // Event emitter setup
    override func supportedEvents() -> [String]! {
        return ["onTokenGenerated"]
    }

    // Method to send the full response so far
    func sendFullResponseEvent(responseSoFar: String) {
        // Trim whitespace and newline characters from the response string
        let trimmedResponse = responseSoFar.trimmingCharacters(in: .whitespacesAndNewlines)
      
        //print("trimmedResponse: \(trimmedResponse)")
        
        // Replace occurrences of `\\n` with `\n`
        let formattedResponse = trimmedResponse.replacingOccurrences(of: "\\n", with: "\n")
      
        //print("formattedResponse: \(formattedResponse)")
        
        // Send the formatted response
        self.sendEvent(withName: "onTokenGenerated", body: ["responseSoFar": formattedResponse])
    }

    // Add the generateResponse function to expose it to JavaScript
    @objc(generateResponse:resolver:rejecter:)
    func generateResponse(prompt: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Call the generate function to process the response
                try await generate(prompt: prompt)
                // Resolve after generation
                resolve(nil)
            } catch {
                // If there's an error, reject the promise
                reject("GenerateError", "Failed to generate response: \(error.localizedDescription)", error)
            }
        }
    }

    @objc(loadModel:rejecter:)
    func loadModel(resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                // Call the existing load function and wait for it to finish
                _ = try await load()
                
                // Resolve the promise after the model is loaded
                resolve(nil)  // You can also pass any useful data if necessary
            } catch {
                // Reject the promise if there was an error loading the model
                reject("ModelLoadError", "Failed to load model: \(error.localizedDescription)", error)
            }
        }
    }

    let modelConfiguration = ModelConfiguration.llama3_2_3B_4bit
    let temperature: Float = 0.4
    let maxTokens = 1000
    let displayEveryNTokens = 4

    var running = false
    var output = ""
    
    // Load model once and use it for subsequent generations
    enum LoadState {
        case idle
        case loaded(ModelContainer)
    }
    
    var loadState = LoadState.idle
    
    private func load() async throws -> ModelContainer {
        switch loadState {
        case .idle:
            // limit the buffer cache
            //MLX.GPU.set(cacheLimit: 20 * 1024 * 1024)
            MLX.Memory.cacheLimit = 20 * 1024 * 1024

            let modelContainer = try await loadModelContainer(configuration: modelConfiguration) {
                [modelConfiguration] progress in
                print("Downloading \(modelConfiguration.id): \(Int(progress.fractionCompleted * 100))%")
            }

            print("Loaded \(modelConfiguration.id). Weights: \(MLX.GPU.activeMemory / 1024 / 1024)M")
            loadState = .loaded(modelContainer)
            return modelContainer

        case .loaded(let modelContainer):
            return modelContainer
        }
    }

    func generate(prompt: String) async throws {
        guard !running else { throw NSError(domain: "LLMNativeModule", code: 1, userInfo: [NSLocalizedDescriptionKey: "Model is currently running"]) }

        running = true
        output = ""

        // Define the parameters for generation
        let generateParameters = GenerateParameters(
            temperature: 0.6  // Example temperature value
        )

        do {
            let modelContainer = try await load()

            // Augment the prompt as needed
//            let preparedPrompt = modelConfiguration.prepare(prompt: prompt)
            let preparedPrompt = prompt

            // Use modelContainer.perform to get the tokenizer synchronously
            let promptTokens: [Int] = await modelContainer.perform { model, tokenizer in
                return tokenizer.encode(text: preparedPrompt)
            }

            // Seed random generation
            MLXRandom.seed(UInt64(Date.timeIntervalSinceReferenceDate * 1000))
          
            await modelContainer.perform { model, tokenizer in
                Algernon.generate(
                    promptTokens: promptTokens,
                    parameters: generateParameters,  // Use the generateParameters defined above
                    model: modelContainer.model,     // Assuming this is accessible
                    tokenizer: modelContainer.tokenizer  // Assuming this is accessible
                ) { tokens in
                    // Capture the tokens and process them outside the closure
                    Task {
                        // Decode tokens asynchronously
                        let newText = tokenizer.decode(tokens: tokens)
                        
                        
                        // Append the new tokens to the output and send the event
                        DispatchQueue.main.async { [weak self] in
    //                        self?.output.append(newText)
                            
                            // Send the entire response so far back to JS
                            self?.sendFullResponseEvent(responseSoFar: newText)
                        }
                    }
                    
                    // Determine whether to continue or stop based on token count
                    if tokens.count >= maxTokens {
                        return .stop
                    } else {
                        return .more
                    }
                }
            }

        } catch {
            DispatchQueue.main.async {
                self.output = "Failed: \(error)"
                // Optionally, send an event for the error as well
            }
        }

        running = false
    }
}
