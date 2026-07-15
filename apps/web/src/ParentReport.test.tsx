import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ParentReportSummary } from './ParentReport.js';

describe('ParentReportSummary', () => {
  it('renders all four parent-only learning coach sections', () => {
    const html = renderToStaticMarkup(
      <ParentReportSummary
        summary={{
          source: 'model',
          practiceContent: 'Practice covered math and direction.',
          progress: 'One skill shows clear improvement.',
          attention: 'Addition remains a useful focus.',
          nextStep: 'Try one short addition practice session.',
        }}
      />
    );

    expect(html).toContain('Practice content');
    expect(html).toContain('Progress evidence');
    expect(html).toContain('Area to support');
    expect(html).toContain('Suggested next step');
    expect(html).toContain('One skill shows clear improvement.');
  });
});
