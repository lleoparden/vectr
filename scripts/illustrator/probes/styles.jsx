/** Character/paragraph styles (Phase 6.5) - minimal, to avoid the dialog that hung the first version. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 300, 200)
  var character = doc.characterStyles.add('Probe Body')
  character.characterAttributes.size = 21
  var paragraph = doc.paragraphStyles.add('Probe Paragraph')
  var out =
    'characterStyles=' +
    doc.characterStyles.length +
    '|paragraphStyles=' +
    doc.paragraphStyles.length +
    '|size=' +
    character.characterAttributes.size +
    '|characterName=' +
    character.name +
    '|paragraphName=' +
    paragraph.name
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
