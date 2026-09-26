import Foundation

struct BPEMerge: Hashable {
    let first: String
    let second: String
}

class CodeGenTokenizer {
    let encoder: [String: Int]
    let decoder: [Int: String]
    let errors: String
    let byteEncoder: [UInt8: String]
    let byteDecoder: [String: UInt8]
    let bpeRanks: [BPEMerge: Int]
    var cache: [String: String] = [:]
    let addPrefixSpace: Bool
    let pat: NSRegularExpression
    let unkToken: String
    let bosToken: String
    let eosToken: String
    let padToken: String?
    let addBosToken: Bool

  // CodeGenTokenizer.swift

  // ...

  init() {
      self.errors = "replace"
      self.byteEncoder = CodeGenTokenizer.bytesToUnicode()
      self.byteDecoder = self.byteEncoder.invertedDict()
      self.addPrefixSpace = false
      self.unkToken = "<|endoftext|>"
      self.bosToken = "<|endoftext|>"
      self.eosToken = "<|endoftext|>"
      self.padToken = nil
      self.addBosToken = false

      if let vocabPath = Bundle.main.path(forResource: "CodeGen-vocab", ofType: "json"),
         let vocabData = try? Data(contentsOf: URL(fileURLWithPath: vocabPath)),
         let vocabJSON = try? JSONSerialization.jsonObject(with: vocabData, options: []) as? [String: Int] {
          self.encoder = vocabJSON
      } else {
          fatalError("Failed to load vocab file")
      }

      self.decoder = self.encoder.invertedDict()

      if let mergesPath = Bundle.main.path(forResource: "CodeGen-merges", ofType: "txt"),
          let mergesData = try? Data(contentsOf: URL(fileURLWithPath: mergesPath)),
          let mergesString = String(data: mergesData, encoding: .utf8) {
          let lines = mergesString.split(separator: "\n")
          if lines.count > 2 {
              let bpeMerges = lines[1..<(lines.count - 1)]
                  .enumerated()
                  .map { index, line -> (Int, BPEMerge) in
                      let pair = line.split(separator: " ")
                      return (index, BPEMerge(first: String(pair[0]), second: String(pair[1])))
                  }
              self.bpeRanks = Dictionary<BPEMerge, Int>(uniqueKeysWithValues: bpeMerges.map { ($0.1, $0.0) })
          } else {
              print("Merges file does not have enough lines. Skipping BPE merges.")
              self.bpeRanks = [:]
          }
      } else {
          fatalError("Failed to load merges file")
      }
    
      self.pat = try! NSRegularExpression(pattern: #"'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"#)
  }

  // ...

  var unknownTokenId: Int {
      return self.encoder[self.unkToken]!
  }

  var eosTokenId: Int {
      return self.encoder[self.eosToken]!
  }

    var vocabSize: Int {
        return self.encoder.count
    }

    func getVocab() -> [String: Int] {
        return self.encoder
    }

  func bpe(token: String) -> String {
      print("token \(token)")
    
      if let cached = self.cache[token] {
          return cached
      }

      var word = token.map { String($0) }
    
      var pairs = CodeGenTokenizer.getPairs(word: word)

      if pairs.isEmpty {
          return token
      }

      while true {
          if let bigram = pairs.min(by: { self.bpeRanks[$0, default: Int.max] < self.bpeRanks[$1, default: Int.max] }) {
              if !self.bpeRanks.keys.contains(bigram) {
                  break
              }
              let (first, second) = (bigram.first, bigram.second)
              var newWord: [String] = []
              var i = 0
              while i < word.count {
                  if let j = word[i..<word.count].firstIndex(of: first) {
                      newWord.append(contentsOf: word[i..<j])
                      i = j
                    
                      if word[i] == first && i < word.count - 1 && word[i + 1] == second {
                          newWord.append(first + second)
                          i += 2
                      } else {
                          newWord.append(word[i])
                          i += 1
                      }
                  } else {
                      newWord.append(contentsOf: word[i..<word.count])
                      break
                  }
              }
              word = newWord
              if word.count == 1 {
                  break
              } else {
                  pairs = CodeGenTokenizer.getPairs(word: word)
              }
          } else {
              break
          }
      }
      let res = word.joined(separator: " ")
      self.cache[token] = res
      return res
  }
  
  func encodeUtf8(_ str: String) -> [UInt8] {
      let utf8Bytes = Array(str.utf8)
      return utf8Bytes
  }

  func tokenize(text: String) -> [String] {
      var bpeTokens: [String] = []
      let matches = self.pat.matches(in: text, range: NSRange(text.startIndex..., in: text))
      for match in matches {
          let token = String(text[Range(match.range, in: text)!])
          let bytes = encodeUtf8(token)
          let encodedToken = token.utf8.map { self.byteEncoder[UInt8($0), default: ""] }.joined()
          let bpeTokensForToken = self.bpe(token: encodedToken).split(separator: " ").map { String($0) }
          bpeTokens.append(contentsOf: bpeTokensForToken)
      }
      return bpeTokens
  }
  
    func encode(text: String) -> [Int] {
        let tokens = self.tokenize(text: text)
        return tokens.map { self.encoder[$0, default: self.encoder[self.unkToken]!] }
    }

    func decode(tokenIds: [Int], skipSpecialTokens: Bool = false, cleanUpTokenizationSpaces: Bool? = nil, truncateBeforePattern: [String]? = nil) -> String {
        var tokens: [String] = []
        for tokenId in tokenIds {
            if let token = self.decoder[tokenId] {
                tokens.append(token)
            } else {
                tokens.append(self.unkToken)
            }
        }

        if skipSpecialTokens {
            tokens = tokens.filter { $0 != self.bosToken && $0 != self.eosToken && $0 != self.padToken }
        }

        var decodedText = self.convertTokensToString(tokens: tokens)

        if let cleanUpTokenizationSpaces = cleanUpTokenizationSpaces, cleanUpTokenizationSpaces {
            decodedText = decodedText.replacingOccurrences(of: " ", with: "")
        }

        if let truncateBeforePattern = truncateBeforePattern {
            for pattern in truncateBeforePattern {
                if let range = decodedText.range(of: pattern, options: .regularExpression) {
                    decodedText = String(decodedText[..<range.lowerBound])
                    break
                }
            }
        }

        return decodedText
    }

    func convertTokensToString(tokens: [String]) -> String {
        let text = tokens.joined()
        let byteArray = text.map { self.byteDecoder[String($0), default: 0] }
        return String(bytes: byteArray, encoding: .utf8) ?? ""
    }

  static func bytesToUnicode() -> [UInt8: String] {
      var bs: [UInt8] = Array(UInt8(33)...UInt8(126)) + Array(UInt8(161)...UInt8(172)) + Array(UInt8(174)...UInt8(255))
      var cs: [String] = bs.map { String(Unicode.Scalar($0)) }
      var n = 0
      for b in 0..<(1 << 8) {
          if !bs.contains(UInt8(b)) {
              bs.append(UInt8(b))
              // Adjust the starting point for mapping non-included bytes to correctly include "Ġ"
              // Given "Ġ" = 288 and it needs to be assigned to space (32), which is the first non-included byte,
              // we set the base to 256 (0x100) to align with the Python implementation's logic
              cs.append(String(Unicode.Scalar(0x100 + n)!))
              n += 1
          }
      }
      return Dictionary(uniqueKeysWithValues: zip(bs, cs))
  }

  static func getPairs(word: [String]) -> Set<BPEMerge> {
      var pairs = Set<BPEMerge>()
      let prevChars = word.dropLast()
      let nextChars = word.dropFirst()
      
      for (prev, next) in zip(prevChars, nextChars) {
          pairs.insert(BPEMerge(first: prev, second: next))
      }
      
      return pairs
  }
}

extension Dictionary where Value: Hashable {
    typealias InvertedDictionary<Value: Hashable, Key: Hashable> = [Value: Key]

    func invertedDict() -> InvertedDictionary<Value, Key> {
        return InvertedDictionary<Value, Key>(uniqueKeysWithValues: self.map { ($1, $0) })
    }
}
