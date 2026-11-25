# re:work | AI Job Search Agent

re:work is a Telegram bot that matches open roles to a job seeker's professional profile and delivers a personalized job feed. I built it around a question that job boards leave to the applicant: which requirements can I already back up with experience, and which should I clarify?

## From profile to job feed

1. In Telegram, the job seeker describes their experience, target roles, locations and preferred delivery frequency.
2. The agent searches company job boards and assesses roles against the professional profile. The feed distinguishes confirmed matches, potential matches and requirements that still need evidence.
3. A Telegram digest summarizes changes. The job seeker can open a card, save a role or answer a question that improves the next assessment.

## Try a fictional job search

The example candidate has led cross-functional launches and built a reporting workflow. One fictional role fits that background. Another calls for direct management of analysts, which the candidate has yet to confirm. The digest keeps both the opportunity and the unanswered question visible.

With Node.js 24 or later, run these commands from the repository root. They work offline with Node's standard library.

```sh
npm run demo
npm test
```

The demo prints the Telegram overview and the first job card, including button actions. The scores, employers and links are fictional. The [digest renderer](digest.mjs) and its [tests](test/digest.test.mjs) come from the current bot. The example starts with the output of the matching stage, so it runs without a Telegram account, a model API key or anyone's CV.

One detail worth checking in the output: the first feed has two open roles and zero new ones. The bot establishes a baseline on the first search. Later digests can then distinguish a newly discovered vacancy from one the job seeker has already seen.

## Roadmap

- Prepare a tailored CV for a selected job directly in Telegram.
- Accept payments for digital services in Telegram Stars.
- Add a companion application for working with job opportunities and CVs.
