import { digestPage } from './digest.mjs';

// Fictional output of the assessment stage. The renderer consumes these results.
const report = {
  kind: 'first',
  date: '2026-11-25',
  counts: { open: 2, new: 0, reopened: 0, closed: 0, pending: 0 },
  jobs: [
    {
      title: 'Product Operations Lead',
      company: 'Harbor Example',
      url: 'https://example.com/jobs/product-operations',
      location: 'Europe',
      workMode: 'remote',
      status: 'current',
      fit: 'confirmed',
      min: 85, max: 90,
      reason: 'The candidate has led two cross-functional launches and built a reporting workflow.',
      blocker: null,
    },
    {
      title: 'Product Analytics Manager',
      company: 'Orchard Example',
      url: 'https://example.com/jobs/product-analytics',
      location: 'Europe',
      workMode: 'remote',
      status: 'current',
      fit: 'potential',
      min: 60, max: 75,
      reason: 'The candidate has reporting experience. Direct management of analysts is still unconfirmed.',
      blocker: 'Direct management experience',
    },
  ],
  questions: ['Have you directly managed a team of analysts?'],
};

// Emit the exact sendMessage fields so the preview can be inspected offline.
const overview = digestPage(report, 'en');
const firstJob = digestPage(report, 'en', 1);
console.log(JSON.stringify({ overview, firstJob }, null, 2));
