/** Text-to-outline (Phase 6.9): the DOM's own createOutline() first, then menu-command fallbacks. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 300, 200)
  var frame = doc.textFrames.add()
  frame.kind = TextType.POINTTEXT
  frame.contents = 'Ab'
  frame.position = [40, 120]
  frame.textRange.characterAttributes.size = 72
  frame.textRange.characterAttributes.textFont = app.textFonts.getByName('MyriadPro-Regular')
  var before = 'pathItems=' + doc.pathItems.length + ',groupItems=' + doc.groupItems.length
  var method = 'none'
  var errorText = 'none'
  try {
    var group = frame.createOutline()
    method = 'createOutline'
    var out =
      'before=' +
      before +
      '|method=' +
      method +
      '|paths=' +
      doc.pathItems.length +
      '|groups=' +
      doc.groupItems.length +
      '|groupBounds=' +
      (group === null ? 'null' : group.geometricBounds.join(','))
    doc.close(SaveOptions.DONOTSAVECHANGES)
    return out
  } catch (error) {
    errorText = 'createOutline:' + error.message
  }
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return 'before=' + before + '|method=' + method + '|error=' + errorText
})()
