/** Text on a path (Phase 6.3): kind, bounds, start offset, side, path length. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 320, 240)
  var path = doc.pathItems.add()
  path.setEntirePath([
    [20, 120],
    [300, 120],
  ])
  var frame = doc.textFrames.pathText(path)
  frame.contents = 'Text on a path'
  frame.textRange.characterAttributes.size = 18
  var startOffset = 'n/a'
  var side = 'n/a'
  var orientation = 'n/a'
  try {
    startOffset = frame.textPath.startOffset
  } catch (error) {
    startOffset = 'error:' + error.message
  }
  try {
    side = frame.textPath.side
  } catch (error) {
    side = 'error:' + error.message
  }
  try {
    orientation = frame.textPath.orientation
  } catch (error) {
    orientation = 'error:' + error.message
  }
  var out =
    frame.kind +
    '|' +
    frame.geometricBounds.join(',') +
    '|' +
    startOffset +
    '|' +
    side +
    '|' +
    orientation +
    '|' +
    path.length
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
