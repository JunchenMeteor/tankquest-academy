import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GameInputController } from './GameInputController.js';
import { TouchControls } from './TouchControls.js';

describe('TouchControls', () => {
  it('renders all localized movement, aim, and fire commands', () => {
    const markup = renderToStaticMarkup(
      <TouchControls
        input={new GameInputController()}
        labels={{
          group: 'Touch controls',
          forward: 'Drive forward',
          backward: 'Reverse',
          turnLeft: 'Turn left',
          turnRight: 'Turn right',
          aimLeft: 'Aim left',
          aimRight: 'Aim right',
          fire: 'Fire',
        }}
      />
    );

    expect(markup.match(/data-touch-command=/g)).toHaveLength(7);
    expect(markup).toContain('aria-label="Drive forward"');
    expect(markup).toContain('aria-label="Aim right"');
    expect(markup).toContain('aria-label="Fire"');
  });
});
