import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isPreviewHost } from './preview-host';
test('main, draft, commit and branded previews are excluded from update registration', () => {
  const id = '9ef0e6b7-7d23-4428-8895-6a82ebf234c8';
  for (const host of [`id-preview--${id}.lovable.app`, `id-preview-6--${id}.lovable.app`, `id-preview-abc123--${id}.lovable.app`, `preview-6--slug.team.gpt-eng.com`, `live--${id}.team.lovable.app`, `live--${id}-thr_abc.team.gptengineer.run`, `project--${id}-dev.lovable.app`, 'abc.lovableproject.com']) assert.equal(isPreviewHost(host), true, host);
});
test('published domains and fake preview suffixes remain public', () => {
  for (const host of ['gyeonjeokit.lovable.app', 'project--9ef0e6b7-7d23-4428-8895-6a82ebf234c8.lovable.app', 'id-preview--abc.evil.com', 'id-preview--abc.lovable.app.evil.com', 'live--fake.team.lovable.app']) assert.equal(isPreviewHost(host), false, host);
});