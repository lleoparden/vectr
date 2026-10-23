/** Vertical type (Phase 6.7): whether the orientation enum exists and what it does to the box. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 300, 300)
  var frame = doc.textFrames.add()
  frame.kind = TextType.POINTTEXT
  frame.contents = 'Vertical 垂直'
  frame.position = [150, 40]
  frame.textRange.characterAttributes.size = 24
  var horizontalBounds = frame.geometricBounds.join(',')
  var result = 'error:none'
  try {
    frame.orientation = TextOrientation.VERTICAL
    result = 'set'
  } catch (error) {
    result = 'error:' + error.message
  }
  var out =
    'orientation=' +
    frame.orientation +
    '|set=' +
    result +
    '|horizontal=' +
    horizontalBounds +
    '|vertical=' +
    frame.geometricBounds.join(',')
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
