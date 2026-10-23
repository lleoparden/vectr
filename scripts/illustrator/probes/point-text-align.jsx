/** Point-text alignment (Phase 6.1): how the box moves around the insertion anchor. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 400, 240)
  var frame = doc.textFrames.add()
  frame.kind = TextType.POINTTEXT
  frame.contents = 'Hamburgefonstiv'
  frame.position = [200, 140]
  frame.textRange.characterAttributes.size = 24
  var lines = []
  var alignments = [
    ['left', Justification.LEFT],
    ['center', Justification.CENTER],
    ['right', Justification.RIGHT],
  ]
  for (var index = 0; index < alignments.length; index += 1) {
    frame.paragraphs[0].paragraphAttributes.justification = alignments[index][1]
    lines.push(alignments[index][0] + '|' + frame.geometricBounds.join(',') + '|' + frame.anchor.join(','))
  }
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return lines.join(';')
})()
