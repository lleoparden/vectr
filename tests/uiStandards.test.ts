/** UI component standards (issue #133): one component per concept, enforced mechanically. */
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')

function files(dir: string, into: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files(full, into)
    else if (/\.(ts|tsx)$/.test(entry.name)) into.push(full)
  }
  return into
}

const sources = files(SRC)
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join('/')

test("no module imports the retired field module", () => {
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8')
    assert.equal(/from '\.[./]*ui\/fields\.tsx'/.test(text), false, relative(file) + " imports the old field module")
    assert.equal(/from '\.\.\/fields\.tsx'/.test(text), false, relative(file) + " imports the old field module")
  }
})

test("a panel does not spell out the shared button or empty-state classes", () => {
  const signatures = ['h-5 w-5 shrink-0', 'rounded-ui border border-accent bg-accent']
  for (const file of sources) {
    if (relative(file).includes('/ui/components/')) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const signature of signatures) {
      assert.equal(text.includes(signature), false, relative(file) + " duplicates the shared button styling: " + signature)
    }
  }
})

test("panel files do not hand-write a <button> that the kit can express", () => {
  for (const panel of ['PropertiesPanel', 'AlignPanel', 'TransformPanel', 'AppearancePanel']) {
    const file = path.join(SRC, 'app/panels', panel + '.tsx')
    const text = fs.readFileSync(file, 'utf8')
    assert.equal(text.includes('<button'), false, panel + " contains a raw <button>; use the shared Button")
  }
})

test("every shared primitive lives in the components folder", () => {
  const components = fs.readdirSync(path.join(SRC, 'app/ui/components')).sort()
  for (const required of ['Button.tsx', 'EmptyState.tsx', 'fields.tsx']) {
    assert.ok(components.includes(required), 'src/app/ui/components/' + required + ' exists')
  }
})
