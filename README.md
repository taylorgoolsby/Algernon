# Algernon

Algernon AI is an AI chat app featuring offline models. 

## Installation

### Whisper

This repo does not use git lfs, therefore, whisper must be manually downloaded and placed. Without it, the project may still build, but text-to-speech will not work.

Download from `ggml-base.bin` from [https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md).

```
sh ./models/download-ggml-model.sh base
```

Place `ggml-base.bin` in `ios/Models` within XCode. Make sure the file is in XCode. 
