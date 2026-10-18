/** Number-field arithmetic (Phase 4.6). */
import test from "node:test"
import assert from "node:assert/strict"
import { evaluateExpression, scrubValue } from "../src/app/ui/number.ts"

test("a field accepts small arithmetic", () => {
  assert.equal(evaluateExpression("120"), 120)
  assert.equal(evaluateExpression("120+30"), 150)
  assert.equal(evaluateExpression("120 - 30"), 90)
  assert.equal(evaluateExpression("100*2"), 200)
  assert.equal(evaluateExpression("(2+2)*10"), 40)
  assert.equal(evaluateExpression("-5+2"), -3)
  assert.equal(evaluateExpression("1.5*4"), 6)
  assert.equal(evaluateExpression("10/4"), 2.5)
})

test("anything that is not arithmetic is refused", () => {
  assert.equal(evaluateExpression(""), null)
  assert.equal(evaluateExpression("12px"), null)
  assert.equal(evaluateExpression("abc"), null)
  assert.equal(evaluateExpression("2+"), null)
  assert.equal(evaluateExpression("(2+3"), null)
  assert.equal(evaluateExpression("1/0"), null)
})

test("a scrub moves two pixels per step, and Shift makes it ten times finer", () => {
  assert.equal(scrubValue(100, 40, 1, false), 120)
  assert.equal(scrubValue(100, 40, 1, true), 102)
  assert.equal(scrubValue(100, -40, 1, false), 80)
  assert.equal(scrubValue(100, 40, 0.5, false), 110)
  assert.equal(scrubValue(95, 40, 1, false, 0, 100), 100, "clamped to the maximum")
  assert.equal(scrubValue(5, -40, 1, false, 0, 100), 0, "clamped to the minimum")
})
