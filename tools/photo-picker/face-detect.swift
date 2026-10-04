import Foundation
import ImageIO
import Vision

// Prints the faces Apple Vision finds in an image as JSON, largest first:
// [{"x": 0.41, "y": 0.12, "w": 0.08, "h": 0.11, "confidence": 0.98}, ...]
// x/y/w/h are fractions of the image width/height, origin at the top left,
// after applying the EXIF orientation (so they match what a browser shows).
// Usage: face-detect <image>
// The photo picker server compiles and runs this; see faceDetector() there.

guard CommandLine.arguments.count == 2,
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  FileHandle.standardError.write("usage: face-detect <image>\n".data(using: .utf8)!)
  exit(1)
}

let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
let orientation = (properties?[kCGImagePropertyOrientation] as? UInt32)
  .flatMap(CGImagePropertyOrientation.init(rawValue:)) ?? .up

let request = VNDetectFaceRectanglesRequest()
try VNImageRequestHandler(cgImage: image, orientation: orientation).perform([request])

// Vision's boxes are normalised with the origin at the bottom left.
let faces = (request.results ?? [])
  .map { face -> [String: Double] in
    let box = face.boundingBox
    return [
      "x": Double(box.minX), "y": Double(1 - box.maxY),
      "w": Double(box.width), "h": Double(box.height),
      "confidence": Double(face.confidence),
    ]
  }
  .sorted { $0["w"]! * $0["h"]! > $1["w"]! * $1["h"]! }

print(String(data: try JSONSerialization.data(withJSONObject: faces), encoding: .utf8)!)
