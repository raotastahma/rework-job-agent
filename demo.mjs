import { digestPage } from './digest.mjs';

// Sample assessment records used in the daily update shown in the README.
const jobGroups = [
  {
    openings: 43,
    title: 'Product Operations Lead',
    company: 'Harbor Example',
    url: 'https://example.com/jobs/product-operations',
    location: 'Europe',
    workMode: 'remote',
    status: 'new',
    fit: 'confirmed',
    min: 85, max: 90,
    reason: 'The candidate has led two cross-functional launches and built a reporting workflow.',
    blocker: null,
  },
  {
    openings: 93,
    title: 'Product Analytics Manager',
    company: 'Orchard Example',
    url: 'https://example.com/jobs/product-analytics',
    location: 'Europe',
    workMode: 'remote',
    status: 'new',
    fit: 'potential',
    min: 60, max: 75,
    reason: 'The candidate has reporting experience. Direct management of analysts is still unconfirmed.',
    blocker: 'Direct management experience',
  },
];

// The two primary employers appear first. Additional openings come from related companies.
const relatedEmployers = ['Cedar Example', 'Juniper Example', 'Birch Example', 'Laurel Example'];
const jobs = jobGroups.flatMap(({ openings, ...job }) =>
  Array.from({ length: openings }, (_, index) => index === 0 ? job : {
    ...job,
    company: relatedEmployers[(index - 1) % relatedEmployers.length],
    origin: 'similar',
    url: `${job.url}-${index + 1}`,
  })
);

const report = {
  kind: 'daily',
  date: '2026-11-27',
  counts: { open: 1421, new: jobs.length, reopened: 0, closed: 0, pending: 0 },
  jobs,
  questions: ['Have you directly managed a team of analysts?'],
};

// Emit the exact sendMessage fields so the preview can be inspected offline.
const overview = digestPage(report, 'en');
const firstJob = digestPage(report, 'en', 1);
console.log(JSON.stringify({ overview, firstJob }, null, 2));
