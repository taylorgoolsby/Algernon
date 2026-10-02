import Foundation
import AVFoundation
import SwiftWhisper
import Accelerate

@objc(AudioTranscription)
class AudioTranscription: NSObject, WhisperDelegate {
    var audioEngine: AVAudioEngine?
    var audioFormat: AVAudioFormat?
    var audioData: [Float] = []
    var whisper: Whisper?
    var onDataCallback: RCTResponseSenderBlock?
    var onErrorCallback: RCTResponseSenderBlock? // New error callback
    var hwSampleRate: Double = 0
  
    // React Native requires this to be exposed for initialization checks
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc
    func initialize(_ resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if whisper != nil {
            resolver("Whisper already initialized")
            return
        }
      
        guard let modelPath = Bundle.main.path(forResource: "ggml-base", ofType: "bin") else {
            reject("Error", "Model path not found", nil)
            return
        }
        print("Model path: \(modelPath)") // Debug print to check the model path

        guard let modelURL = URL(string: modelPath),
              let whisperModel = try? Whisper(fromFileURL: modelURL) else {
            reject("Error", "Failed to initialize Whisper model", nil)
            return
        }
        whisper = whisperModel
        whisper?.delegate = self
        resolver("Whisper initialized")
    }

    @objc
    func start(_ resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        audioEngine = AVAudioEngine()

        guard let audioEngine = audioEngine else {
            reject("Error", "Failed to initialize audio engine", nil)
            return
        }
      
        // For resuming background music from another app:
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                options: [.allowBluetoothA2DP, .allowAirPlay, .mixWithOthers, .duckOthers]  // Ducking instead of stopping background music
            )
            try AVAudioSession.sharedInstance().setMode(.default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            reject("Error", "Failed to activate audio session", error)
            return
        }

        let inputNode = audioEngine.inputNode
        hwSampleRate = audioEngine.inputNode.outputFormat(forBus: 0).sampleRate

        guard let audioFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: hwSampleRate, channels: 1, interleaved: false) else {
            reject("Error", "Failed to create audio format", nil)
            return
        }
        self.audioFormat = audioFormat

        // Clear the audio data array before starting a new recording
        audioData.removeAll()

        // Install a tap on the input node to capture audio data
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: audioFormat) { (buffer, time) in
            self.processAudioBuffer(buffer: buffer)
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
            resolver("Recording started")
        } catch {
            reject("Error", "Recording failed to start", error)
        }
    }

    @objc
    func stop(_ resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        audioEngine?.stop()
        audioEngine = nil
      
        // For resuming background music from another app:
        do {
            try AVAudioSession.sharedInstance().setActive(false) // Deactivate the session to reset
            try AVAudioSession.sharedInstance().setCategory(.soloAmbient, options: []) // Ensure background music can resume on Bluetooth
        } catch {
            reject("Error", "Failed to deactivate and reset audio session", error)
            return
        }

        if hwSampleRate > 16000 {
            audioData = Self.downsample(audioData, from: hwSampleRate, to: 16000)
        } else if hwSampleRate < 16000 {
            onErrorCallback?(["Hardware sample rate must be greater than 16k for downsampling"]) // Invoke the error callback with the error
            onErrorCallback = nil // Reset the error callback after invoking
            reject("Error", "Hardware sample rate must be greater than 16k for downsampling", nil)
            return
        }

        Task {
            do {
                if let segments = try await whisper?.transcribe(audioFrames: audioData) {
                    let transcription = segments.map(\.text).joined()
                    onDataCallback?([transcription])
                    onDataCallback = nil  // Reset the callback after invoking
                    resolver("Transcription complete")
                } else {
                    reject("Error", "Whisper failed to transcribe", nil)
                }
            } catch {
                onErrorCallback?([error.localizedDescription]) // Invoke the error callback with the error
                onErrorCallback = nil // Reset the error callback after invoking
                reject("Error", "Transcription failed", error)
            }
        }
    }

    @objc
    func onData(_ callback: @escaping RCTResponseSenderBlock) {
        self.onDataCallback = callback
    }
  
    @objc
    func onError(_ callback: @escaping RCTResponseSenderBlock) {
        self.onErrorCallback = callback
    }

    private func processAudioBuffer(buffer: AVAudioPCMBuffer) {
        guard let floatChannelData = buffer.floatChannelData else { return }
        let channelDataPointer = floatChannelData.pointee
        let frameLength = Int(buffer.frameLength)

        // Copy new samples to the audioData array
        let newSamples = UnsafeBufferPointer(start: channelDataPointer, count: frameLength)
        audioData.append(contentsOf: newSamples)
    }

    // Downsample function using Accelerate framework
    static func downsample(_ input: [Float], from inputSampleRate: Double, to outputSampleRate: Double) -> [Float] {
        let decimationFactor = Int(inputSampleRate / outputSampleRate)
        let filterLength = decimationFactor
        let filter = [Float](repeating: 1 / Float(filterLength), count: filterLength)

        // Perform the decimation
        let outputSignal = vDSP.downsample(input, decimationFactor: decimationFactor, filter: filter)
        return outputSignal
    }

    // WhisperDelegate methods
    func whisper(_ aWhisper: Whisper, didUpdateProgress progress: Double) {
        // Handle progress updates
        print("Transcription progress: \(progress * 100)%")
    }

    func whisper(_ aWhisper: Whisper, didProcessNewSegments segments: [Segment], atIndex index: Int) {
        // Handle new segments of transcribed text
        print("New segments processed: \(segments.map(\.text).joined(separator: " "))")
    }

    func whisper(_ aWhisper: Whisper, didCompleteWithSegments segments: [Segment]) {
        // Handle completion of transcription
        print("Transcription complete: \(segments.map(\.text).joined(separator: " "))")
    }

    func whisper(_ aWhisper: Whisper, didErrorWith error: Error) {
        // Handle errors during transcription
        print("Transcription error: \(error.localizedDescription)")
    }
}
