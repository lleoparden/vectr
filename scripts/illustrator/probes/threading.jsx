/** Threading (Phase 6.4): two linked area frames, where the overflow lands. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 400, 300)
  var first = doc.textFrames.areaText(doc.pathItems.rectangle(260, 20, 160, 100))
  var second = doc.textFrames.areaText(doc.pathItems.rectangle(140, 20, 160, 180))
  var sentence = 'Threading sends the overflow into the next frame. '
  var text = ''
  for (var index = 0; index < 20; index += 1) text += sentence
  first.contents = text
  first.nextFrame = second
  var out =
    'first=' +
    first.lines.length +
    '|second=' +
    second.lines.length +
    '|firstChars=' +
    first.contents.length +
    '|secondChars=' +
    second.contents.length +
    '|linked=' +
    (second.previousFrame === first ? 1 : 0) +
    '|firstBounds=' +
    first.geometricBounds.join(',') +
    '|secondBounds=' +
    second.geometricBounds.join(',')
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
