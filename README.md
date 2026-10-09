# Algernon

![Logo](./ios/Algernon/Images.xcassets/AppIcon.appiconset/Å-40.jpg)

![Demo](./demo.gif)

Algernon AI is an AI chat app featuring offline models, built in React-Native 87 for iOS 27.

## Installation

Some files are too big to add to git. You will need to add them to your Xcode project in order to build.

### Whisper

Download one of the Whisper models converted in ggml format. For example:

```
sh ./models/download-ggml-model.sh base
```

More info on downloading whisper models here: https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md

Once you have obtained a model, add it to the `Models` folder in Xcode.

### FAISS

Follow the guide to build the FAISS xcframeworks here: https://github.com/DeveloperMindset-com/faiss-mobile/blob/master/examples/FAISS-iOS-Swift/README.md

Then place `faiss.xcframework` and `faiss_c.xcframework` in the `Frameworks` folder in xcode.