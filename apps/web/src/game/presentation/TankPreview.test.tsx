import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TankPreview } from './TankPreview.js';

describe('TankPreview', () => {
  it('uses equipped colors and exposes the resolved silhouette', () => {
    const markup = renderToStaticMarkup(
      <TankPreview
        code="iron-mountain"
        primaryColor="#426b8a"
        secondaryColor="#d7edf7"
      />
    );

    expect(markup).toContain('data-tank-visual="iron-mountain"');
    expect(markup).toContain('data-tank-details="armor-brow track-guards"');
    expect(markup).toContain('#426b8a');
    expect(markup).toContain('#d7edf7');
  });

  it('renders different detail paths for the three player tanks', () => {
    const previews = ['star-shield', 'swift-fox', 'iron-mountain'].map((code) =>
      renderToStaticMarkup(<TankPreview code={code} />)
    );

    expect(new Set(previews).size).toBe(3);
  });
});
