/** Tabs (Phase 6.6): what the scripting API actually exposes on paragraph tab stops. */
;(function () {
  var doc = app.documents.add(DocumentColorSpace.RGB, 400, 200)
  var frame = doc.textFrames.add()
  frame.kind = TextType.POINTTEXT
  frame.contents = 'Left\tCentre\tRight'
  frame.position = [20, 100]
  frame.textRange.characterAttributes.size = 12
  var paragraph = frame.paragraphs[0]
  var type = typeof paragraph.tabStops
  var count = -1
  try {
    count = paragraph.tabStops.length
  } catch (error) {
    count = -2
  }
  var addResult = 'not-attempted'
  try {
    paragraph.tabStops.add(120, TabStopAlignment.LEFT)
    addResult = 'added'
  } catch (error) {
    addResult = 'error:' + error.message
  }
  var assignResult = 'not-attempted'
  try {
    paragraph.tabStops = [{ position: 120, alignment: TabStopAlignment.LEFT }]
    assignResult = 'assigned'
  } catch (error) {
    assignResult = 'error:' + error.message
  }
  var positions = []
  try {
    for (var index = 0; index < paragraph.tabStops.length; index += 1) positions.push(paragraph.tabStops[index].position)
  } catch (error) {
    positions.push('error')
  }
  var attributesTabStops = 'absent'
  try {
    attributesTabStops = typeof paragraph.paragraphAttributes.tabStops + ':' + paragraph.paragraphAttributes.tabStops.length
  } catch (error) {
    attributesTabStops = 'error:' + error.message
  }
  var out =
    'type=' +
    type +
    '|count=' +
    count +
    '|add=' +
    addResult +
    '|assign=' +
    assignResult +
    '|positions=' +
    positions.join(',') +
    '|attributes=' +
    attributesTabStops
  doc.close(SaveOptions.DONOTSAVECHANGES)
  return out
})()
