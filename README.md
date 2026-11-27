# re:work | AI Job Search Agent

<p align="center">
  <img src="assets/rework-logo.png" alt="re:work" width="340">
</p>

Upload your CV and answer a few questions about your experience and preferences. re:work uses that profile to find vacancies on company career sites. Choose daily delivery to get newly discovered matches in Telegram. Assessed roles show an experience-match percentage or range, the evidence behind it, and requirements that still need clarification.

**[Start re:work in Telegram](https://t.me/CVBuilderCareerBot)**

## Get your first shortlist

1. Open the bot in a private Telegram chat and press **Start**.
2. Answer eight questions about locations, work authorization, work format, relocation, companies, roles, exclusions and digest frequency. Choose **1** for daily updates, or another positive number of days.
3. Upload your CV as **PDF, DOCX, TXT or MD, up to 4 MiB**, paste its text, or send a readable professional-profile link. PDFs need selectable text. For a file or readable link, tap **Review source**, check the extracted text, then **Add to my professional profile**. If a link cannot be read, upload a file or paste the text.
4. The first search starts once your experience is added. Your digest arrives in the same chat after search and assessment finish. Open a vacancy title to visit the employer, use **❤️** to save it, or open **Questions** to clarify missing experience.

The bot builds a professional profile from your materials and answers. Follow-up questions help separate confirmed experience from gaps that still need evidence. **Best match** ranks assessed open roles; **Favourite vacancies** keeps your bookmarks. You can change preferences in the chat and use **Schedule** to set the search start time and time zone, change the interval, or pause updates. Delivery follows completion of each search.

## What the result looks like

This example shows a daily update and two of the newly found jobs. The counts, employers and profile are sample data.

> **Vacancy update**<br>
> Open: 1,421 · New: 136<br>
> Confirmed fit: 43 · Potential fit: 93
>
> **Product Operations Lead · Harbor Example**<br>
> Remote · Europe · New · Confirmed fit<br>
> Experience coverage: **85–90%**<br>
> Basis: The candidate has led two cross-functional launches and built a reporting workflow.
>
> **Product Analytics Manager · Orchard Example**<br>
> Remote · Europe · New · Potential fit<br>
> Experience coverage: **60–75%**<br>
> Required condition: Direct management experience.<br>
> Question: Have you directly managed a team of analysts?

The percentage measures how much of a vacancy's requirements the profile supports. A range shows where a follow-up answer could change the assessment. The first search establishes which roles are already open. Later digests report new openings and flag earlier vacancies that reopened, closed or received a new assessment.

## Explore the public code

This repository contains a snapshot of the pilot's [Telegram digest renderer](digest.mjs), an illustrative example and [tests](test/digest.test.mjs). The running bot also handles onboarding, CV import, profile updates, vacancy discovery and scheduled searches. Its private runtime and user materials are not included here.

With Node.js 24 or later, run from the repository root:

```sh
npm run demo
npm test
```

These commands run offline using Node's standard library. The demo renders an already assessed sample feed, including the overview, first job card and button actions.

## Roadmap

- Prepare a tailored CV for a selected job directly in Telegram.
- Accept payments for digital services in Telegram Stars.
- Add a companion application for working with job opportunities and CVs.
