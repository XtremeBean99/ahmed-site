import assert from 'node:assert/strict'
import test from 'node:test'
import { renderUiSprite } from './ui-art'
import { UI_SPRITES, UI_SPRITE_NAMES } from './ui-sprites'

test('renderUiSprite produces every manifest size', () => {
  for (const name of UI_SPRITE_NAMES) {
    const meta = UI_SPRITES[name]
    const sprite = renderUiSprite(name)
    assert.equal(sprite.width, meta.width, `${name} width`)
    assert.equal(sprite.height, meta.height, `${name} height`)
  }
})

test('renderUiSprite never returns a fully transparent sprite', () => {
  for (const name of UI_SPRITE_NAMES) {
    const sprite = renderUiSprite(name)
    let opaque = 0
    for (let i = 3; i < sprite.data.length; i += 4) {
      if (sprite.data[i] !== 0) opaque += 1
    }
    assert.ok(opaque > 0, `${name} should not be fully transparent`)
  }
})
