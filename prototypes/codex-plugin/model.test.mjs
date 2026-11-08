import test from 'node:test';
import assert from 'node:assert/strict';
import { areas, flows, parts, searchKnowledgeBase, recordQAResult } from './model.mjs';

test('each Flow has one Area and all named Parts resolve', () => {
  assert.equal(new Set(flows.map(flow => flow.name)).size, flows.length);
  for (const flow of flows) {
    assert.ok(areas.some(area => area.id === flow.area));
    if (flow.toWrite) {
      assert.equal(flow.steps, undefined);
      assert.equal(flow.qa, undefined);
    } else {
      assert.ok(flow.steps.length);
      for (const step of flow.steps) {
        assert.ok(step.parts.length);
        step.parts.forEach(id => assert.ok(parts.some(part => part.id === id)));
      }
    }
  }
  for (const part of parts) {
    assert.ok(flows.some(flow => flow.steps?.some(step => step.parts.includes(part.id))));
    assert.ok(part.anchors.length);
  }
});

test('search finds Flows and Parts, ignoring surrounding whitespace and case', () => {
  assert.ok(searchKnowledgeBase('  INVITATION ').some(result => result.kind === 'Part'));
  assert.ok(searchKnowledgeBase('invite').some(result => result.kind === 'Flow'));
  assert.deepEqual(searchKnowledgeBase('impossible-search-term'), []);
});

test('recording a QA Result replaces only that QA Step and keeps the note', () => {
  const first = recordQAResult({}, 'invite', 0, 'failed', 'No email arrived');
  const second = recordQAResult(first, 'invite', 1, 'passed', '');
  const third = recordQAResult(second, 'invite', 0, 'passed', 'Email arrived');
  assert.equal(first['invite:0'].outcome, 'failed');
  assert.equal(third['invite:0'].outcome, 'passed');
  assert.equal(third['invite:0'].note, 'Email arrived');
  assert.equal(third['invite:1'].outcome, 'passed');
  assert.equal(Object.keys(third).length, 2);
});

test('QA Results reject outcomes that are not in the glossary', () => {
  assert.throws(() => recordQAResult({}, 'invite', 0, 'pending', ''), /outcome/);
});
