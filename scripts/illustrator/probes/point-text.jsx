/**
 * Illustrator point-text metrics probe (Phase 6.1).
 *
 * Creates point text at three sizes, records the measured box, leading, and position in **points**,
 * and closes without saving. No document is left open, and no Adobe file is read.
 */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 320, 200)
  var sizes = [12, 18, 24]
  var lines = []
  for (var index = 0; index < sizes.length; index += 1) {
    var frame = doc.textFrames.add()
    frame.kind = TextType.POINTTEXT
    frame.contents = 'Hamburgefonstiv'
    frame.position = [20, 120 - index * 40]
    frame.textRange.characterAttributes.size = sizes[index]
    var bounds = frame.geometricBounds
    lines.push(
      sizes[index] +
        '|' +
        frame.textRange.characterAttributes.leading +
        '|' +
        bounds.join(',') +
        '|' +
        frame.position.join(',') +
        '|' +
        frame.textRange.characterAttributes.textFont.name,
    )
  }
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return lines.join(';')
})()
