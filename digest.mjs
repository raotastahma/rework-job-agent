import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const LIMIT = 4096;
const STATUSES = ['current', 'new', 'reopened', 'reassessed', 'closed'];
const FITS = ['confirmed', 'potential', 'excluded'];
const WORK_MODES = ['remote','hybrid','onsite','remote_or_onsite','hybrid_or_onsite'];
const COPY = {
  en: {
    digest: 'Vacancy digest', first: 'First vacancy digest', daily: 'Vacancy update', summary: 'HR assessment',
    runFailed:'The vacancy search stopped because of an error.',runTimeout:'The vacancy search reached its time limit. These are the results collected so far.',
    runPartial:'The search finished with gaps. See the affected catalogs and vacancies below.',unresolvedRetries:'Unresolved temporary failures',
    current: 'Currently open', open: 'Open', new: 'New', reopened: 'Reopened',
    closed: 'Closed', pending: 'Awaiting verification', reassessed: 'Reassessed', reassessedShown: 'Reassessed cards shown',
    completed:'Screening completed',assessed:'Vacancies assessed',retry:'Temporary failures; retry scheduled',failedProcessing:'Processing failed',deferred:'Not yet processed',
    confirmed: 'Confirmed fit', potential: 'Potential fit', excluded: 'Excluded',
    shown: 'Among shown active changes', highlights: 'Worth reviewing',
    firstShown: 'Among shown current vacancies', baseline: 'Initial baseline: existing vacancies are not counted as new.',
    noConfirmed: 'No confirmed fit among the shown vacancies.', firstEmpty: 'No personal vacancy cards in this first digest.',
    noChanges: 'No new, reopened or closed vacancies recorded. No reassessed cards to show.',
    received: 'Company catalogs received', partial: 'Partial catalogs', failed: 'Unavailable companies',
    incomplete: 'Catalog coverage is incomplete; this report does not establish a complete catalog.',
    empty: 'No vacancy changes to show.', experience: 'Experience coverage',
    unscored: 'Not assessed', reason: 'Basis', blocker: 'Required conditions',
    questions: 'Questions', noQuestions: 'No questions in this digest.',
    action: 'Review the vacancies or answer the questions to clarify the assessment.',
    details: 'Details', next: 'Next', back: 'Back', overview: 'Overview',
    menu: 'Menu', continued: 'Continued', page: 'Page', similar: 'Similar company',
    best: 'Best match', savedOn: 'Saved results as of', updating: 'Previous assessment',
    noBest: 'No open vacancies with a saved match score yet.',
    favourites: 'Favourite vacancies',
    noFavourites: 'No favourite vacancies yet.', unchecked: 'Availability unconfirmed',
    workModes: {remote:'Remote',hybrid:'Hybrid',onsite:'On-site',remote_or_onsite:'Remote or on-site',hybrid_or_onsite:'Hybrid or on-site'},
    noMode:'Work format not specified',
  },
  ru: {
    digest: 'Подборка вакансий', first: 'Первая подборка вакансий', daily: 'Обновление вакансий', summary: 'Вывод HR-агента',
    runFailed:'Поиск вакансий прервался из-за ошибки.',runTimeout:'Время поиска истекло. Ниже результаты, которые удалось получить.',
    runPartial:'Поиск завершён частично. Ниже указано, какие каталоги и вакансии не удалось проверить полностью.',unresolvedRetries:'Нерешённые временные сбои',
    current: 'Сейчас открыта', open: 'Открыто', new: 'Новые', reopened: 'Снова открыты',
    closed: 'Закрыты', pending: 'Ожидают проверки', reassessed: 'Переоценены', reassessedShown: 'Переоценены среди показанных',
    completed:'Проверка завершена',assessed:'Оценено вакансий',retry:'Временные сбои, запланирован повтор',failedProcessing:'Не удалось обработать',deferred:'Ещё не обработано',
    confirmed: 'Подтверждённое соответствие', potential: 'Потенциальное соответствие', excluded: 'Исключена',
    shown: 'Среди показанных открытых изменений', highlights: 'Стоит посмотреть',
    firstShown: 'Среди показанных текущих вакансий', baseline: 'Первый срез: существующие вакансии не считаются новыми.',
    noConfirmed: 'Среди показанных вакансий нет подтверждённого соответствия.', firstEmpty: 'В первой подборке нет персональных карточек вакансий.',
    noChanges: 'Новых, снова открытых и закрытых вакансий не зафиксировано. Переоценённых карточек для показа нет.',
    received: 'Получены каталоги компаний', partial: 'Частично прочитаны', failed: 'Недоступные компании',
    incomplete: 'Охват каталогов неполный; эта подборка не подтверждает полноту каталога.',
    empty: 'Изменений вакансий для показа нет.', experience: 'Покрытие опытом',
    unscored: 'Не оценено', reason: 'Основание', blocker: 'Обязательные условия',
    questions: 'Вопросы', noQuestions: 'В этой подборке вопросов нет.',
    action: 'Посмотрите вакансии или ответьте на вопросы для уточнения оценки.',
    details: 'Подробнее', next: 'Далее', back: 'Назад', overview: 'Обзор',
    menu: 'Меню', continued: 'Продолжение', page: 'Страница', similar: 'Похожая компания',
    best: 'Лучшие вакансии', savedOn: 'Сохранённые результаты на', updating: 'По предыдущей оценке',
    noBest: 'Пока нет открытых вакансий с сохранённой оценкой соответствия.',
    favourites: 'Избранные вакансии',
    noFavourites: 'В избранном пока нет вакансий.', unchecked: 'Открытость не подтверждена',
    workModes: {remote:'Удалённо',hybrid:'Гибрид',onsite:'В офисе',remote_or_onsite:'Удалённо или в офисе',hybrid_or_onsite:'Гибрид или офис'},
    noMode:'Формат работы не указан',
  },
};

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name}: expected object`);
  return value;
}

function string(value, name, max = Infinity) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${name}: invalid text`);
  }
  return value.trim();
}

function publicUrl(value) {
  const text = string(value, 'url', 2048);
  if (/\s/u.test(text)) throw new TypeError('url: whitespace is not allowed');
  let url;
  try { url = new URL(text); } catch { throw new TypeError('url: invalid absolute URL'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/u, '').toLowerCase();
  const ipv4 = isIP(host) === 4 ? host.split('.').map(Number) : null;
  const private4 = ipv4 && (ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] >= 224
    || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)
    || (ipv4[0] === 192 && ipv4[1] === 168));
  const private6 = isIP(host) === 6 && (host === '::' || host === '::1' || /^(?:f[cd]|fe[89ab]|::ffff:)/u.test(host));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !host.includes('.') && !isIP(host)
    || /(?:^|\.)(?:localhost|local)$/u.test(host) || private4 || private6 || url.href.length > 2048) {
    throw new TypeError('url: expected public HTTP(S) URL without credentials');
  }
  return url.href;
}

/** Validate an already assessed, owner-scoped report. This function does not assess fit. */
export function normalizeDigest(raw) {
  object(raw, 'digest');
  const date = string(raw.date, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new TypeError('date: expected YYYY-MM-DD');
  object(raw.counts, 'counts');
  const counts = {};
  for (const key of ['open', 'new', 'reopened', 'closed', 'pending']) {
    if (!Number.isSafeInteger(raw.counts[key]) || raw.counts[key] < 0) throw new TypeError(`counts.${key}: expected nonnegative integer`);
    counts[key] = raw.counts[key];
  }
  let processing;
  if(raw.processing!==undefined){
    object(raw.processing,'processing');processing={};
    for(const key of ['completed','assessed','excluded','pending','retry','failed']){
      const value=raw.processing[key];
      if(!Number.isSafeInteger(value)||value<0)throw new TypeError('processing: expected nonnegative counts');
      processing[key]=value;
    }
  }
  if (raw.kind !== undefined && !['first', 'daily'].includes(raw.kind)) throw new TypeError('kind: expected first or daily');
  if (raw.interruption !== undefined && !['failed','timeout'].includes(raw.interruption)) throw new TypeError('Invalid search interruption');
  if (raw.kind === 'first' && counts.new !== 0) throw new TypeError('counts.new: first digest must use a zero baseline');
  let coverage;
  if (raw.coverage !== undefined) {
    object(raw.coverage, 'coverage');
    const { checked, requested, partial, failed } = raw.coverage;
    if (![checked, requested].every((n) => Number.isSafeInteger(n) && n >= 0) || checked > requested
      || !Array.isArray(partial) || !Array.isArray(failed)) throw new TypeError('coverage: invalid counts or company lists');
    coverage = { checked, requested, partial: Array.from(partial, (name) => string(name, 'coverage.partial', 160)),
      failed: Array.from(failed, (name) => string(name, 'coverage.failed', 160)) };
    const names = [...coverage.partial, ...coverage.failed];
    if (new Set(names).size !== names.length || partial.length > checked || failed.length > requested - checked) {
      throw new TypeError('coverage: inconsistent or duplicate companies');
    }
    if(raw.coverage.issues!==undefined){
      if(!Array.isArray(raw.coverage.issues))throw new TypeError('coverage: invalid issues');
      coverage.issues=raw.coverage.issues.map(item=>{
        object(item,'coverage issue');
        if(!['not_found','ambiguous','http403','unavailable','unsupported','timeout','discovering','partial'].includes(item.reason))throw new TypeError('coverage: invalid reason');
        return {company:string(item.company,'company',160),reason:item.reason};
      });
    }
  }
  if (!Array.isArray(raw.jobs) || !Array.isArray(raw.questions)) throw new TypeError('jobs and questions: expected arrays');
  const jobs = Array.from(raw.jobs, (item) => {
    object(item, 'job');
    if (!STATUSES.includes(item.status) || !FITS.includes(item.fit)) throw new TypeError('job: invalid status or fit');
    if(item.origin!==undefined&&!['primary','similar'].includes(item.origin))throw new TypeError('job: invalid origin');
    if (!(item.min === null && item.max === null)
      && !([item.min, item.max].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100) && item.min <= item.max)) {
      throw new TypeError('job: expected an ordered 0..100 range or two nulls');
    }
    const blocker = item.blocker === null ? null : string(item.blocker, 'blocker');
    if (item.fit === 'confirmed' && blocker !== null) throw new TypeError('job: confirmed fit cannot have an unresolved required condition');
    return {
      title: string(item.title, 'title', 200), company: string(item.company, 'company', 160),
      url: publicUrl(item.url), status: item.status, fit: item.fit, min: item.min, max: item.max,
      reason: string(item.reason, 'reason'), blocker,...(item.origin===undefined?{}:{origin:item.origin}),
      ...vacancyPlacement(item),
    };
  });
  for (const key of ['new', 'reopened', 'closed']) {
    if (jobs.filter((job) => job.status === key).length > counts[key]) throw new TypeError(`counts.${key}: fewer than shown jobs`);
  }
  if (jobs.filter((job) => job.status !== 'closed').length > counts.open) throw new TypeError('counts.open: fewer than shown active jobs');
  const questions = Array.from(raw.questions, (question) => string(question, 'question', 3000)).slice(0, 5);
  return { date, counts, jobs, questions, ...(raw.kind === undefined ? {} : { kind: raw.kind }), ...(coverage ? { coverage } : {}),
    ...(processing?{processing}:{}),...(raw.interruption?{interruption:raw.interruption}:{}),
    ...(raw.summary === undefined ? {} : { summary: string(raw.summary, 'summary', 600) }) };
}

const escape = (text) => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
const short = (text, limit) => Array.from(text).length <= limit ? text : `${Array.from(text).slice(0, limit - 1).join('')}…`;
const score = (job, c) => job.min === null ? c.unscored : `${c.experience}: ${job.min}${job.min === job.max ? '' : `–${job.max}`}%`;
const titleLink=(url,title)=>`<a href="${escape(url)}">${title}</a>`;
// Link targets are not part of Telegram's displayed message length.
const messageLength=text=>text.replace(/ href="[^"]*"/gu,'').length;
const favouriteKey=url=>createHash('sha256').update(url).digest('hex').slice(0,32);
const closedVacancy=row=>row.open===false||row.deleted||row.removed||['closed','deleted','removed'].includes(row.status);
const modeLabel=String.raw`(?:fully remote|remote|hybrid|on[- ]?site|in[- ]office|удал[её]нно|гибрид|в офисе)`;
const modeAtStart=new RegExp(`^(${modeLabel})(?:$|\\s*[:,]\\s*|\\s+[-–]\\s+|\\s+in\\s+)`,'iu');
const modeAtEnd=new RegExp(`,\\s*(${modeLabel})$`,'iu');
const modeInLocation=new RegExp(`(?:^|[\\s(,:])${modeLabel}(?=$|[\\s),:])`,'iu');
const explicitMode=new RegExp(`(?:^\\s*(?:workplace type|work model|work format)\\s*:\\s*|\\bthis (?:(?:role|position|job) )?is (?:a )?)(${modeLabel})(?=$|[.;]|\\s+(?:role|position|job|based|in|within)\\b)`,'iu');
const officeAlternative=/\bwork from (?:one of )?(?:our |the )?offices? or (remotely|hybrid)\b/iu;
const placementText=(value,limit)=>typeof value==='string'?value.replace(/[\s\u0000-\u001f\u007f]+/gu,' ').trim().slice(0,limit):'';

function workMode(label) {
  if(/remote|удал/iu.test(label))return 'remote';
  if(/hybrid|гибрид/iu.test(label))return 'hybrid';
  return 'onsite';
}

export function vacancyPlacement(row) {
  const raw=placementText(row.location,3000);
  let workDetails=placementText(row.workDetails,260);
  const modes=new Set();
  const locations=raw.split(/\s*[·|;]\s*/u).flatMap(part=>{
    const match=part.match(modeAtStart)??part.match(modeAtEnd);
    if(!match)return part?[part]:[];
    modes.add(workMode(match[1]));
    const location=part.replace(match[0],'').trim();
    return location?[location]:[];
  });
  if(WORK_MODES.includes(row.workMode))modes.add(row.workMode);
  const requirements=row.assessment?.audit?.requirements;
  if(!modes.size&&Array.isArray(requirements)){
    for(const requirement of requirements){
      if(requirement?.kind!=='work_arrangement'||requirement.source!=='description')continue;
      const quote=placementText(requirement.quote,260);
      const match=quote.match(explicitMode),alternative=quote.match(officeAlternative);
      if(alternative)modes.add(alternative[1].toLowerCase()==='hybrid'?'hybrid_or_onsite':'remote_or_onsite');
      else if(match)modes.add(workMode(match[1]));
      if(!workDetails&&(alternative||match&&/\b(?:based|within|only|must)\b/iu.test(quote)))workDetails=quote;
    }
  }
  const location=(modes.size>1?raw:[...new Set(locations)].join(' · ')).slice(0,3000);
  const mode=modes.size===1?[...modes][0]:null;
  return {...(location?{location}:{}),...(mode?{workMode:mode}:{}),...(workDetails?{workDetails}:{})};
}

function placeLine(job,c) {
  const primary=[job.workMode?c.workModes[job.workMode]:job.location&&!modeInLocation.test(job.location)&&!job.workDetails?c.noMode:null,
    job.location&&excerpt(job.location,135)].filter(Boolean).join(' · ');
  return [primary,job.workDetails&&excerpt(job.workDetails,130)].filter(Boolean).map(line=>'\n'+line).join('');
}

function favouriteButton(key,favourites,number,page) {
  const saved=Object.hasOwn(favourites,key);
  return {text:(number?`${number} `:'')+(saved?'💔':'❤️'),
    callback_data:`fav:${saved?'remove':'add'}:${key}${saved&&page!==undefined?`:${page}`:''}`};
}

export function refreshFavouriteButtons(markup,favourites) {
  if(!Array.isArray(markup?.inline_keyboard))return null;
  let changed=false;
  const inline_keyboard=markup.inline_keyboard.map(row=>row.map(button=>{
    const request=favouriteRequest(button.callback_data);
    if(!request?.action)return button;
    const next=favouriteButton(request.key,favourites,button.text.match(/^\d+\b/u)?.[0]);
    if(next.text===button.text&&next.callback_data===button.callback_data)return button;
    changed=true;
    return {...button,...next};
  }));
  return changed?{inline_keyboard}:null;
}

function coverageText(coverage, c) {
  if (!coverage) return '';
  let text = `\n${c.received}: ${coverage.checked}/${coverage.requested}`;
  for (const key of ['partial', 'failed']) {
    if (coverage[key].length) {
      const names = coverage[key].slice(0, 2).map((name) => escape(short(name, 20))).join(', ');
      text += `\n${c[key]} (${coverage[key].length}): ${names}${coverage[key].length > 2 ? ` … (+${coverage[key].length - 2})` : ''}`;
    }
  }
  if (coverage.checked < coverage.requested || coverage.partial.length || coverage.failed.length) text += `\n${c.incomplete}`;
  const reasons=c===COPY.ru?{not_found:'источник вакансий не найден',ambiguous:'источник требует уточнения',http403:'источник ограничил доступ',unavailable:'источник временно недоступен',unsupported:'публичный каталог недоступен',timeout:'источник не ответил вовремя',discovering:'ищем источник вакансий',partial:'каталог получен частично'}:
    {not_found:'vacancy source not found',ambiguous:'source needs clarification',http403:'source restricted access',unavailable:'source temporarily unavailable',unsupported:'public catalog unavailable',timeout:'source did not respond in time',discovering:'locating the vacancy source',partial:'catalog received partially'};
  for(const issue of (coverage.issues??[]).slice(0,2))text+='\n'+escape(short(issue.company,25))+': '+reasons[issue.reason];
  return text;
}

function escapedChunks(text, size) {
  const chunks = [];
  let part = '';
  for (const character of text) {
    const next = escape(character);
    if (part.length + next.length > size) {
      const boundary = Math.max(part.lastIndexOf(' '), part.lastIndexOf('\n')) + 1;
      const end = boundary > size / 2 ? boundary : part.length;
      chunks.push(part.slice(0, end));
      part = part.slice(end);
    }
    part += next;
  }
  if (part) chunks.push(part);
  return chunks;
}

function detailPages(digest, c) {
  const pages = [];
  if (digest.summary) pages.push({ text: `<b>${c.summary}</b>\n\n${escape(digest.summary)}`, job: null });
  for (const job of digest.jobs) {
    const heading = `<b>${titleLink(job.url,escape(job.title))} · ${escape(job.company)}</b>${placeLine(job,c)}\n${c[job.status]} · ${c[job.fit]}${job.origin==='similar'?' · '+c.similar:''}`;
    const continuation = `${heading}\n<i>${c.continued}</i>`;
    const budget = LIMIT - messageLength(continuation) - 140;
    const parts = [score(job, c), ...escapedChunks(`${c.reason}: ${job.reason}`, budget)];
    if (job.blocker !== null) parts.push(...escapedChunks(`${c.blocker}: ${job.blocker}`, budget));
    let text = heading;
    for (const part of parts) {
      if (messageLength(text) + part.length + 2 > LIMIT - 100) { pages.push({ text, job }); text = continuation; }
      text += `\n\n${part}`;
    }
    pages.push({ text, job });
  }
  return pages;
}

/** A sendMessage/editMessageText body; the caller supplies chat/message identity. */
export function digestPage(input, ui = 'en', page = 0, favourites = {}, history) {
  const digest = normalizeDigest(input);
  if(digest.jobs.some(job=>!job.location||!job.workMode)){
    const records=new Map(Object.values(history?.records??{}).map(row=>[row.url,row]));
    digest.jobs=digest.jobs.map(job=>{
      const row=records.get(job.url);
      return row?{...vacancyPlacement(row),...job}:job;
    });
  }
  if (!['en', 'ru'].includes(ui)) throw new TypeError('ui: expected en or ru');
  const c = COPY[ui];
  const heading = digest.kind ? c[digest.kind] : c.digest;
  const details = detailPages(digest, c);
  if (!Number.isSafeInteger(page) || page < 0 || page > details.length) throw new RangeError('page: out of range');
  const callback = (target) => `dig:p:${digest.date}:${target}`;
  const keyboard = [];
  if(digest.interruption==='failed')return {text:`<b>${heading} · ${digest.date}</b>\n${c.runFailed}`,parse_mode:'HTML',
    reply_markup:{inline_keyboard:[[{text:c.menu,callback_data:'menu'}]]}};
  let text;
  if (page === 0) {
    const active = digest.jobs.filter((job) => job.status !== 'closed');
    const reassessed = digest.jobs.filter((job) => job.status === 'reassessed').length;
    const confirmed = active.filter((job) => job.fit === 'confirmed').length;
    text = `<b>${heading} · ${digest.date}</b>${coverageText(digest.coverage, c)}\n${c.open}: ${digest.counts.open}\n`
      + `${c.new}: ${digest.counts.new} · ${c.reopened}: ${digest.counts.reopened} · ${c.closed}: ${digest.counts.closed}\n`
      + `${c.pending}: ${digest.counts.pending} · ${digest.kind ? c.reassessedShown : c.reassessed}: ${reassessed}\n\n`
      + `${digest.kind === 'first' ? c.firstShown : c.shown}:\n${c.confirmed}: ${confirmed} · ${c.potential}: ${active.filter((job) => job.fit === 'potential').length}`;
    if(digest.processing){
      const p=digest.processing;
      text+=`\n${c.completed}: ${p.completed} · ${c.assessed}: ${p.assessed}\n${digest.interruption==='timeout'?c.unresolvedRetries:c.retry}: ${p.retry} · ${c.failedProcessing}: ${p.failed} · ${c.deferred}: ${p.pending}`;
    }
    const partial=digest.coverage?.checked<digest.coverage?.requested||digest.coverage?.partial.length||digest.processing?.failed||digest.processing?.pending;
    if(digest.interruption==='timeout'||partial){
      const newline=text.indexOf('\n');
      text=text.slice(0,newline)+'\n'+(digest.interruption==='timeout'?c.runTimeout:c.runPartial)+text.slice(newline);
    }
    if (digest.kind === 'first') text += `\n${c.baseline}${confirmed ? '' : `\n${c.noConfirmed}`}`;
    if (digest.kind === 'daily' && !digest.counts.new && !digest.counts.reopened && !digest.counts.closed && !reassessed) text += `\n${c.noChanges}`;
    if (digest.summary) text += `\n\n<b>${c.summary}</b>\n${escape(short(digest.summary, 80))}`;
    const highlights = active.filter((job) => job.fit !== 'excluded').sort((a, b) => Number(a.origin==='similar')-Number(b.origin==='similar') || FITS.indexOf(a.fit) - FITS.indexOf(b.fit)
      || (b.min ?? -1) - (a.min ?? -1) || (b.max ?? -1) - (a.max ?? -1)).slice(0, 2);
    if (highlights.length) text += `\n\n<b>${c.highlights}</b>`;
    const highlightButtons=[];
    for (const [index, job] of highlights.entries()) {
      text += `\n\n${index + 1}. <b>${titleLink(job.url,escape(short(job.title, 50)))}</b> · ${escape(short(job.company, 25))}${placeLine(job,c)}\n`
        + `${c[job.status]} · ${c[job.fit]}${job.origin==='similar'?' · '+c.similar:''}\n${score(job, c)}\n${escape(short(job.reason, 60))}`;
      if (job.blocker !== null) text += `\n${c.blocker}: ${escape(short(job.blocker, 40))}`;
      highlightButtons.push(favouriteButton(favouriteKey(job.url),favourites,index+1));
    }
    if(highlightButtons.length)keyboard.push(highlightButtons);
    if (digest.jobs.length === 0 && digest.kind !== 'daily') text += `\n\n${digest.kind === 'first' ? c.firstEmpty : c.empty}`;
    text += `\n\n${digest.questions.length ? `${c.questions}: ${digest.questions.length}` : c.noQuestions}`;
    if (digest.jobs.length || digest.questions.length) text += `\n${c.action}`;
    if (details.length) keyboard.push([{ text: `${c.details} (${details.length})`, callback_data: callback(1) }]);
  } else {
    const detail = details[page - 1];
    text = `<b>${heading} · ${digest.date}</b>\n${c.page} ${page}/${details.length}\n\n${detail.text}`;
    if(detail.job&&(!closedVacancy(detail.job)||Object.hasOwn(favourites,favouriteKey(detail.job.url))))
      keyboard.push([favouriteButton(favouriteKey(detail.job.url),favourites)]);
    const navigation = [{ text: c.back, callback_data: callback(page - 1) }];
    if (page < details.length) navigation.push({ text: c.next, callback_data: callback(page + 1) });
    keyboard.push(navigation, [{ text: c.overview, callback_data: callback(0) }]);
  }
  if (digest.questions.length) keyboard.push([{ text: `${c.questions} (${digest.questions.length})`, callback_data: `dig:q:${digest.date}` }]);
  if(page===0&&digest.kind&&digest.counts.open)keyboard.push([{text:c.best,callback_data:'best'}]);
  keyboard.push([{ text: c.menu, callback_data: 'menu' }]);
  if (messageLength(text) > LIMIT) throw new RangeError('digest: rendered page exceeds Telegram limit');
  return { text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard } };
}

export function bestMatchRequest(callback,text) {
  if(callback==='best'||/^\/best_match(?:@\w+)?$/iu.test(text?.trim()??''))return {page:0};
  const match=/^best:(\d{4}-\d{2}-\d{2}):(\d{1,6})$/u.exec(callback??'');
  return match?{date:match[1],page:Number(match[2])}:null;
}

export function favouriteRequest(callback,text) {
  if(callback==='fav'||/^\/favourite(?:@\w+)?$/iu.test(text?.trim()??''))return {page:0};
  const page=/^fav:p:(\d{1,6})$/u.exec(callback??'');
  if(page)return {page:Number(page[1])};
  const listRemove=/^fav:remove:([a-f0-9]{32}):(\d{1,6})$/u.exec(callback??'');
  if(listRemove)return {action:'remove',key:listRemove[1],page:Number(listRemove[2])};
  const change=/^fav:(add|remove):([a-f0-9]{32})$/u.exec(callback??'');
  return change?{action:change[1],key:change[2]}:null;
}

// Re-render lists sent before removal callbacks included the page number.
export function legacyFavouritePage(messageText) {
  const [title,pagination='']=messageText?.split('\n',2)??[];
  const copy=Object.values(COPY).find(c=>c.favourites===title);
  if(!copy)return null;
  const page=pagination.startsWith(copy.page+' ')?/ ([1-9]\d{0,5})\/\d+$/u.exec(pagination):null;
  return page?Number(page[1])-1:0;
}

function savedVacancy(row) {
  try{
    return {url:publicUrl(row.url),title:string(row.title,'title',200),company:string(row.company,'company',160),...vacancyPlacement(row)};
  }catch{return null;}
}

export function findFavouriteVacancy(history,digest,key) {
  for(const row of [...Object.values(history?.records??{}),...(digest?.jobs??[])]){
    const saved=savedVacancy(row);
    if(saved&&favouriteKey(saved.url)===key)
      return closedVacancy(row)||row.availabilityUnconfirmed?null:saved;
  }
  return null;
}

const excerpt=(value,limit)=>escape(value).length<=limit?escape(value):escapedChunks(value,limit-1)[0].trimEnd()+'…';
const linkedHeading=(job,number)=>`\n\n${number}. <b>${titleLink(job.url,excerpt(job.title,120))}</b> · ${excerpt(job.company,70)}`;

function vacancyList(c,text,jobs,page,{empty,navigation,card,button}) {
  const keyboard=[];
  if(!jobs.length)text+='\n\n'+empty;
  else {
    const pageLabel='\n'+c.page+' ';
    const digits=String(jobs.length).length;
    const budget=LIMIT-messageLength(text)-pageLabel.length-2*digits-1;
    const pages=[];
    let group={text:'',length:0,buttons:[]};
    for(const [index,job] of jobs.entries()){
      const number=index+1,body=card(job,number),length=messageLength(body);
      if(group.buttons.length===10||group.length+length>budget){
        pages.push(group);
        group={text:'',length:0,buttons:[]};
      }
      group.text+=body;group.length+=length;
      group.buttons.push(button(job,number,pages.length));
    }
    pages.push(group);
    if(page>=pages.length)page=pages.length-1;
    text+=pageLabel+(page+1)+'/'+pages.length+pages[page].text;
    const vacancyButtons=pages[page].buttons;
    for(let start=0;start<vacancyButtons.length;start+=5)keyboard.push(vacancyButtons.slice(start,start+5));
    if(navigation&&pages.length>1)keyboard.push([
      ...(page>0?[{text:c.back,callback_data:navigation(page-1)}]:[]),
      ...(page+1<pages.length?[{text:c.next,callback_data:navigation(page+1)}]:[]),
    ]);
  }
  keyboard.push([{text:c.menu,callback_data:'menu'}]);
  return {text,parse_mode:'HTML',link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:keyboard}};
}

export function favouriteVacanciesPage(favourites,history,ui,page=0) {
  const c=COPY[ui];
  const current=new Map();
  for(const row of Object.values(history?.records??{})){
    const job=savedVacancy(row);
    if(job)current.set(job.url,{...job,status:closedVacancy(row)?c.closed:row.availabilityUnconfirmed?c.unchecked:c.current});
  }
  const jobs=Object.values(favourites).toReversed().map(savedVacancy).filter(Boolean).map(job=>({...job,...current.get(job.url)}));
  return vacancyList(c,'<b>'+c.favourites+'</b>',jobs,page,{
    empty:c.noFavourites,navigation:n=>`fav:p:${n}`,
    card:(job,number)=>linkedHeading(job,number)+placeLine(job,c)+'\n'+(job.status??c.unchecked),
    button:(job,number,listPage)=>favouriteButton(favouriteKey(job.url),favourites,number,listPage),
  });
}

export function bestMatchPage(history,ui,{date,page=0}={},favourites={}) {
  const c=COPY[ui];
  const scopes=new Set(Object.values(history?.scopes??{}));
  const jobs=Object.values(history?.records??{}).flatMap(row=>{
    const a=row?.assessment;
    if(row?.open!==true||closedVacancy(row)
      ||row.availabilityUnconfirmed||row.selected!==true
      ||row.scope&&scopes.size&&!scopes.has(row.scope)||!['confirmed','potential'].includes(a?.fit)
      ||!Number.isFinite(a.min)||!Number.isFinite(a.max)||a.min<0||a.max>100||a.min>a.max)return [];
    const job=savedVacancy(row);
    return job?[{...job,previous:row.pending===true||!!row.failure,fit:a.fit,min:a.min,max:a.max,
      reason:typeof a.reason==='string'?a.reason:'',blocker:typeof a.blocker==='string'?a.blocker:''}]:[];
  }).sort((a,b)=>FITS.indexOf(a.fit)-FITS.indexOf(b.fit)||b.min-a.min||b.max-a.max
    ||a.company.localeCompare(b.company)||a.title.localeCompare(b.title)||a.url.localeCompare(b.url));
  const seen=new Set();
  const unique=jobs.filter(job=>{
    if(seen.has(job.url))return false;
    seen.add(job.url);return true;
  });
  const savedDate=/^\d{4}-\d{2}-\d{2}$/u.test(history?.date??'')?history.date:null;
  const heading='<b>'+c.best+'</b>'+(unique.length&&savedDate?'\n'+c.savedOn+' '+savedDate:'');
  return vacancyList(c,heading,unique,date&&date!==savedDate?0:page,{
    empty:c.noBest,navigation:savedDate?(n=>`best:${savedDate}:${n}`):null,
    card:(job,number)=>{
      let card=linkedHeading(job,number)+placeLine(job,c)+'\n'+score(job,c)+' · '+c[job.fit];
      if(job.previous)card+='\n'+c.updating;
      if(job.reason)card+='\n'+excerpt(job.reason,130);
      if(job.blocker)card+='\n'+c.blocker+': '+excerpt(job.blocker,110);
      return card;
    },
    button:(job,number)=>favouriteButton(favouriteKey(job.url),favourites,number),
  });
}
