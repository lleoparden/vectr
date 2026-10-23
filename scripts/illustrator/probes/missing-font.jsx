/** Missing fonts (Phase 6.8): what scripting does when a family is absent. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 300, 200)
  var frame = doc.textFrames.add()
  frame.kind = TextType.POINTTEXT
  frame.contents = 'Missing font probe'
  frame.position = [20, 100]
  var fontCount = app.textFonts.length
  var applyResult = 'error:none'
  try {
    frame.textRange.characterAttributes.textFont = app.textFonts.getByName('NoSuchFamily-Regular')
    applyResult = 'applied'
  } catch (error) {
    applyResult = 'error:' + error.message
  }
  var current = 'n/a'
  try {
    current = frame.textRange.characterAttributes.textFont.name
  } catch (error) {
    current = 'error:' + error.message
  }
  var missing = 0
  try {
    // Fonts referenced by the document but not installed are absent from app.textFonts; count by name.
    var referenced = frame.textRange.characterAttributes.textFont.name
    var found = false
    for (var index = 0; index < app.textFonts.length; index += 1) {
      if (app.textFonts[index].name === referenced) found = true
    }
    missing = found ? 0 : 1
  } catch (error) {
    missing = -1
  }
  var out =
    'fonts=' +
    fontCount +
    '|apply=' +
    applyResult +
    '|current=' +
    current +
    '|missing=' +
    missing
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
