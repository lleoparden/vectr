/** Area text (Phase 6.2): box, line count, first baseline, overflow. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 400, 300)
  // areaText takes a rectangle path item, not a bounds array.
  var rectangle = doc.pathItems.rectangle(260, 20, 200, 200)
  var frame = doc.textFrames.areaText(rectangle)
  var sentence = 'The quick brown fox jumps over the lazy dog. '
  var text = ''
  for (var index = 0; index < 40; index += 1) text += sentence
  frame.contents = text
  var lines = frame.lines.length
  var visibleLines = frame.textRange.lines.length
  var firstBaseline = -1
  try {
    firstBaseline = frame.firstBaselineOffset
  } catch (error) {
    firstBaseline = -1
  }
  var overflow = -1
  try {
    overflow = frame.overflows ? 1 : 0
  } catch (error) {
    overflow = -1
  }
  var out =
    frame.kind +
    '|' +
    frame.geometricBounds.join(',') +
    '|' +
    lines +
    '|' +
    visibleLines +
    '|' +
    firstBaseline +
    '|' +
    overflow
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
