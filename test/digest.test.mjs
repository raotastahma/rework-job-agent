import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDigest, digestPage, bestMatchPage, bestMatchRequest } from '../digest.mjs';

test('vacancy cards show saved geography and explicit work format in the interface language',()=>{
  const date='2026-11-24';
  const original=job({title:'Product Lead',status:'current'});
  const history={date,records:{one:{...original,open:true,selected:true,location:'Europe',assessment:{
    ...original,audit:{requirements:[{source:'description',kind:'work_arrangement',quote:'This is a remote role based in Europe.'}]},
  }}}};
  const manual=report({date,jobs:[original]});
  assert.match(digestPage(manual,'en',0,{},history).text,/Remote · Europe/u);
  assert.match(digestPage(manual,'ru',1,{},history).text,/Удалённо · Europe/u);
  assert.match(bestMatchPage(history,'ru').text,/Удалённо · Europe/u);
  assert.match(digestPage(report({jobs:[{...original,location:'Remote, Europe · Remote'}]})).text,/Remote · Europe/u);
  history.records.one.location='Tokyo';
  history.records.one.assessment.audit.requirements[0].quote='The benefits package includes a WFH equipment allowance.';
  assert.match(bestMatchPage(history,'en').text,/Work format not specified · Tokyo/u);
  assert.doesNotMatch(bestMatchPage(history,'en').text,/Remote · Tokyo/u);
  history.records.one.location='Worldwide';
  history.records.one.assessment.audit.requirements[0].quote='Flexible work from one of our offices or remotely within time zones from GMT-2 to GMT+5';
  assert.match(bestMatchPage(history,'en').text,/Remote or on-site · Worldwide\n[^\n]+GMT-2 to GMT\+5/u);
});

test('Best match paginates a ranked list, deduplicates links and fits the Telegram limit',()=>{
  const date='2026-11-24',text='<&"'.repeat(65);
  const records=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),{
    title:'Product Lead '+i,company:'Example',url:'https://example.com/jobs/'+i,open:true,selected:true,
    assessment:{fit:'potential',min:i*7,max:100,reason:'Saved assessment',blocker:null},
  }]));
  records.duplicate={...records[11],assessment:{...records[11].assessment,min:10}};
  const history={date,records};
  const links=page=>[...page.text.matchAll(/href="https:\/\/example\.com\/jobs\/(\d+)"/gu)].map(match=>Number(match[1]));
  const order=Array.from({length:12},(_,i)=>11-i);
  const first=bestMatchPage(history,'en');
  assert.match(first.text,/<b>Best match<\/b>/);
  assert.match(first.text,/Page 1\/2/);
  assert.ok(first.text.length<=4096);
  assert.deepEqual(links(first),order.slice(0,10));
  assert.deepEqual(first.reply_markup.inline_keyboard.slice(0,2).map(row=>row.map(button=>button.text)),[
    ['1 ❤️','2 ❤️','3 ❤️','4 ❤️','5 ❤️'],['6 ❤️','7 ❤️','8 ❤️','9 ❤️','10 ❤️'],
  ]);
  const next=buttons(first).find(b=>b.text==='Next');
  const second=bestMatchPage(history,'en',bestMatchRequest(next.callback_data));
  assert.deepEqual(links(second),order.slice(10));
  const [add]=second.reply_markup.inline_keyboard[0];
  assert.deepEqual(second.reply_markup.inline_keyboard[0].map(button=>button.text),['11 ❤️','12 ❤️']);
  const savedKey=add.callback_data.slice('fav:add:'.length);
  const saved=bestMatchPage(history,'ru',{page:1},{[savedKey]:records['1']});
  assert.deepEqual(saved.reply_markup.inline_keyboard[0][0],{text:'11 💔',callback_data:`fav:remove:${savedKey}`});

  for(const row of Object.values(records)){
    row.title=text;
    row.company=text.slice(0,130);
    row.pending=true;
    Object.assign(row.assessment,{reason:text.repeat(10),blocker:text.repeat(10)});
  }
  const longFirst=bestMatchPage(history,'ru');
  const longNext=buttons(longFirst).find(b=>b.text==='Далее');
  const longSecond=bestMatchPage(history,'ru',bestMatchRequest(longNext.callback_data));
  assert.ok(links(longFirst).length<10);
  assert.ok([longFirst,longSecond].every(page=>page.text.replace(/ href="[^"]*"/gu,'').length<=4096));
  assert.deepEqual([...links(longFirst),...links(longSecond)],order);
  assert.equal(buttons(longSecond).find(b=>b.text==='Далее'),undefined);
});

const job = (change = {}) => ({
  title: 'Product Lead', company: 'Example', url: 'https://example.com/jobs/1',
  status: 'new', fit: 'potential', min: 70, max: 90,
  reason: 'Product launches are confirmed; people management remains unknown.',
  blocker: 'People management: ask the candidate.', ...change,
});
const report = (change = {}) => ({
  date: '2026-11-14', counts: { open: 640, new: 2, reopened: 1, closed: 3, pending: 4 },
  jobs: [job(), job({ title: 'Growth Lead', url: 'https://example.com/jobs/2' })],
  questions: ['How many people did you directly manage?'], ...change,
});
const buttons = (payload) => payload.reply_markup.inline_keyboard.flat();

test('normalizes a separate stable value and caps digest questions at five', () => {
  const raw = report({ questions: Array.from({ length: 7 }, (_, i) => `Question ${i + 1}?`), extra: 'ignored' });
  const digest = normalizeDigest(raw);
  assert.deepEqual(Object.keys(digest), ['date', 'counts', 'jobs', 'questions']);
  assert.equal(digest.questions.length, 5);
  assert.notEqual(digest.jobs[0], raw.jobs[0]);
  assert.notEqual(digest.counts, raw.counts);
  assert.equal(digest.jobs[0].min, 70);
  assert.equal(digest.jobs[0].max, 90);
});

test('processing diagnostics distinguish catalog totals, assessments, temporary and permanent failures',()=>{
  const input=report({kind:'first',counts:{open:1000,new:0,reopened:0,closed:0,pending:472},jobs:[],questions:[],
    processing:{completed:528,assessed:0,excluded:0,retry:470,failed:2,pending:0},
    coverage:{checked:1,requested:1,partial:[],failed:[],issues:[{company:'Example <company>',reason:'partial'}]}});
  const normalized=normalizeDigest(input);
  assert.deepEqual(normalized.processing,input.processing);assert.notEqual(normalized.processing,input.processing);
  const en=digestPage(input).text,ru=digestPage(input,'ru').text;
  assert.match(en,/Open: 1000/);assert.match(en,/Vacancies assessed: 0/);assert.match(en,/retry scheduled: 470/);
  assert.match(en,/Processing failed: 2/);assert.match(en,/Example &lt;company&gt;/);
  assert.match(ru,/Оценено вакансий: 0/);assert.match(ru,/запланирован повтор: 470/);
  for(const processing of [{...input.processing,retry:-1},{...input.processing,assessed:'0'}]){
    assert.throws(()=>normalizeDigest({...input,processing}),TypeError);
  }
  assert.throws(()=>normalizeDigest({...input,coverage:{...input.coverage,issues:[{company:'Example',reason:'PRIVATE_CAUSE'}]}}),TypeError);
});

test('the first card separates new, reopened, closed and reassessed without a threshold claim', () => {
  const input = report({ jobs: [job(), job({ status: 'reassessed', min: 88, max: 95 })] });
  const payload = digestPage(input);
  assert.match(payload.text, /New: 2 · Reopened: 1 · Closed: 3/);
  assert.match(payload.text, /Reassessed: 1/);
  assert.match(payload.text, /Among shown active changes:\nConfirmed fit: 0 · Potential fit: 2/);
  assert.match(payload.text, /Experience coverage: 88–95%/);
  assert.match(payload.text, /Required conditions: People management/);
  assert.doesNotMatch(payload.text, /85|suitable|guarantee/iu);
  assert.ok(buttons(payload).some((button) => button.callback_data === 'dig:p:2026-11-14:1'));
  assert.ok(buttons(payload).some((button) => button.callback_data === 'dig:q:2026-11-14'));
  assert.ok(buttons(payload).some((button) => button.callback_data === 'menu'));
});

test('preserves supplied confirmed fit and null scores without inferring a score', () => {
  const input = report({ jobs: [job({ fit: 'confirmed', blocker: null, min: null, max: null })] });
  const text = digestPage(input).text;
  assert.match(text, /Confirmed fit: 1/);
  assert.match(text, /Not assessed/);
  assert.doesNotMatch(text, /\d+%/);
});

test('Russian details show supplied reason, required condition, link and predictable navigation', () => {
  const input = report();
  const payload = digestPage(input, 'ru', 1);
  assert.match(payload.text, /Подборка вакансий/);
  assert.match(payload.text, /Основание: Product launches are confirmed/);
  assert.match(payload.text, /Обязательные условия: People management/);
  assert.ok(payload.text.includes(`<a href="${input.jobs[0].url}">${input.jobs[0].title}</a>`));
  assert.ok(buttons(payload).some(button=>button.text==='❤️'&&button.callback_data.startsWith('fav:add:')));
  assert.ok(!buttons(payload).some(button=>button.url));
  assert.ok(buttons(payload).some((button) => button.callback_data === 'dig:p:2026-11-14:0'));
  assert.ok(buttons(payload).some((button) => button.callback_data === 'dig:p:2026-11-14:2'));
  assert.doesNotMatch(payload.text, /\u2014/u);
});

test('closed and excluded jobs stay in details and are omitted from review highlights', () => {
  const input = report({ jobs: [job({ status: 'closed', fit: 'excluded', reason: 'The employer confirmed closure.', blocker: null })] });
  assert.doesNotMatch(digestPage(input).text, /Worth reviewing/);
  assert.match(digestPage(input, 'en', 1).text, /Closed · Excluded/);
  assert.match(digestPage(input, 'en', 1).text, /The employer confirmed closure/);
  assert.ok(!buttons(digestPage(input,'en',1)).some(button=>button.callback_data.startsWith('fav:add:')));
});

test('escapes report HTML and keeps literal source text from controlling Telegram formatting', () => {
  const payload = digestPage(report({ jobs: [job({ title: '<b>Lead</b>', reason: '<script>x</script> & "facts"' })] }), 'en', 1);
  assert.match(payload.text, /&lt;b&gt;Lead&lt;\/b&gt;/);
  assert.match(payload.text, /&lt;script&gt;x&lt;\/script&gt; &amp; &quot;facts&quot;/);
  assert.doesNotMatch(payload.text, /<script>|<b>Lead<\/b>/);
  assert.equal(payload.parse_mode, 'HTML');
  assert.deepEqual(payload.link_preview_options, { is_disabled: true });
});

test('paginates long escaped evidence without dropping text, breaking entities or exceeding 4096', () => {
  const reason = 'Evidence <&>😀 '.repeat(1000);
  const input = report({ jobs: [job({ reason, blocker: 'Missing <mandatory> evidence. '.repeat(400) })] });
  let page = 1;
  const pages = [];
  while (true) {
    const payload = digestPage(input, 'en', page);
    assert.ok(payload.text.length <= 4096);
    assert.doesNotMatch(payload.text, /&(?!amp;|lt;|gt;|quot;)/u);
    assert.equal((payload.text.match(/<a href=/gu)??[]).length,1);
    pages.push(payload.text);
    const next = buttons(payload).find((button) => button.text === 'Next');
    if (!next) break;
    assert.equal(next.callback_data, `dig:p:2026-11-14:${page + 1}`);
    page += 1;
  }
  assert.ok(pages.length > 5);
  const all = pages.join('');
  assert.equal((all.match(/Evidence/g) || []).length, 1000);
  assert.equal((all.match(/Missing/g) || []).length, 400);
});

test('all maximal summaries remain compact and within the Telegram limit', () => {
  const input = report({ jobs: Array.from({ length: 2 }, () => job({ title: '"'.repeat(200), company: '"'.repeat(160), reason: '"'.repeat(400), blocker: '"'.repeat(400) })) });
  assert.ok(digestPage(input).text.length <= 4096);
  assert.ok(digestPage(input, 'ru').text.length <= 4096);
  assert.ok(digestPage(input, 'ru', 1).text.length <= 4096);
});

test('empty report has menu, zero counts and no dead detail or question button', () => {
  const payload = digestPage(report({ counts: { open: 0, new: 0, reopened: 0, closed: 0, pending: 0 }, jobs: [], questions: [] }));
  assert.match(payload.text, /No vacancy changes to show/);
  assert.match(payload.text, /No questions in this digest/);
  assert.deepEqual(buttons(payload), [{ text: 'Menu', callback_data: 'menu' }]);
});

test('rejects dangerous, local, malformed or credential-bearing vacancy links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '/jobs/1', 'https://user:secret@example.com/',
    'https://localhost/jobs', 'https://localhost./jobs', 'https://service.local./', 'https://service.local/', 'http://127.0.0.1/', 'http://0x7f000001/', 'http://10.1.2.3/',
    'http://172.16.1.1/', 'http://192.168.1.1/', 'http://169.254.169.254/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/',
    'https://example.com/a\nb', 'https://example.com/a b']) {
    assert.throws(() => normalizeDigest(report({ jobs: [job({ url })] })), { name: 'TypeError' }, url);
  }
});

test('validates date, report shape, counts, statuses, ranges, text and blocker consistency', () => {
  const cases = [null, [], {}, report({ date: '2026-02-30' }), report({ date: '2026-1-01' }), report({ jobs: {} }),
    report({ questions: 'question' }), report({ questions: [''] }), report({ jobs: [job({ status: 'open' })] }),
    report({ jobs: [job({ fit: 'suitable' })] }), report({ jobs: [job({ min: 90, max: 70 })] }),
    report({ jobs: [job({ min: -1 })] }), report({ jobs: [job({ max: 101 })] }), report({ jobs: [job({ min: null })] }),
    report({ jobs: [job({ min: NaN })] }), report({ jobs: [job({ title: '' })] }), report({ jobs: [job({ reason: 'x\u0000' })] }),
    report({ jobs: [job({ blocker: undefined })] }), report({ jobs: [job({ fit: 'confirmed' })] }),
    report({ counts: { open: 0, new: 2, reopened: 1, closed: 0, pending: 0 } }),
    report({ counts: { open: 640, new: 1, reopened: 0, closed: 0, pending: 0 } }),
  ];
  for (const key of ['open', 'new', 'reopened', 'closed', 'pending']) {
    for (const value of [-1, 0.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1]) cases.push(report({ counts: { ...report().counts, [key]: value } }));
  }
  for (const input of cases) assert.throws(() => normalizeDigest(input), { name: 'TypeError' });
  assert.doesNotThrow(() => normalizeDigest(report({ date: '2028-02-29' })));
});

test('rejects invalid page indices or unsupported interface language', () => {
  for (const page of [-1, 0.5, 3, '1', NaN]) assert.throws(() => digestPage(report(), 'en', page), { name: 'RangeError' });
  assert.throws(() => digestPage(report(), 'fr'), { name: 'TypeError' });
  assert.throws(() => digestPage(report(), 'toString'), { name: 'TypeError' });
});

test('first automated digest uses current baseline cards and shows zero confirmed fit explicitly', () => {
  const input = report({ kind: 'first', counts: { open: 640, new: 0, reopened: 0, closed: 0, pending: 2 },
    coverage: { checked: 2, requested: 2, partial: [], failed: [] }, jobs: [job({ status: 'current' })] });
  const normalized = normalizeDigest(input);
  assert.equal(normalized.kind, 'first');
  assert.deepEqual(normalized.coverage, input.coverage);
  assert.notEqual(normalized.coverage, input.coverage);
  const payload = digestPage(input);
  assert.match(payload.text, /First vacancy digest/);
  assert.match(payload.text, /Company catalogs received: 2\/2/);
  assert.match(payload.text, /Open: 640\nNew: 0/);
  assert.match(payload.text, /Currently open · Potential fit/);
  assert.match(payload.text, /Initial baseline: existing vacancies are not counted as new/);
  assert.match(payload.text, /No confirmed fit among the shown vacancies/);
  assert.doesNotMatch(payload.text, /No vacancy changes/);
  assert.match(digestPage(input, 'ru', 1).text, /Первая подборка вакансий/);
  assert.match(digestPage(input, 'ru', 1).text, /Сейчас открыта/);
});

test('first digest reports an empty baseline outcome rather than implying a successful match', () => {
  const input = report({ kind: 'first', counts: { open: 0, new: 0, reopened: 0, closed: 0, pending: 0 },
    coverage: { checked: 0, requested: 1, partial: [], failed: ['Example'] }, jobs: [], questions: [] });
  const payload = digestPage(input, 'ru');
  assert.match(payload.text, /Первая подборка вакансий/);
  assert.match(payload.text, /Получены каталоги компаний: 0\/1/);
  assert.match(payload.text, /Недоступные компании \(1\): Example/);
  assert.match(payload.text, /нет подтверждённого соответствия/);
  assert.match(payload.text, /нет персональных карточек вакансий/);
  assert.deepEqual(buttons(payload), [{ text: 'Меню', callback_data: 'menu' }]);
});

test('daily digest distinguishes no changes from incomplete catalog coverage and pending verification', () => {
  const input = report({ kind: 'daily', counts: { open: 640, new: 0, reopened: 0, closed: 0, pending: 4 },
    coverage: { checked: 2, requested: 3, partial: ['Example <partial>'], failed: ['Unavailable & Co'] }, jobs: [], questions: [] });
  const payload = digestPage(input);
  assert.match(payload.text, /Vacancy update/);
  assert.match(payload.text, /New: 0 · Reopened: 0 · Closed: 0/);
  assert.match(payload.text, /Awaiting verification: 4 · Reassessed cards shown: 0/);
  assert.match(payload.text, /No new, reopened or closed vacancies recorded. No reassessed cards to show/);
  assert.match(payload.text, /Partial catalogs \(1\): Example &lt;partial&gt;/);
  assert.match(payload.text, /Unavailable companies \(1\): Unavailable &amp; Co/);
  assert.match(payload.text, /coverage is incomplete/);
  assert.doesNotMatch(payload.text, /No vacancy changes to show/);
});

test('daily new, reopened and reassessed personal cards are separate from catalog totals', () => {
  const input = report({ kind: 'daily', coverage: { checked: 3, requested: 3, partial: [], failed: [] },
    jobs: [job(), job({ status: 'reopened' }), job({ status: 'reassessed' }), job({ status: 'closed', fit: 'excluded', blocker: null })] });
  const payload = digestPage(input, 'ru');
  assert.match(payload.text, /Обновление вакансий/);
  assert.match(payload.text, /Новые: 2 · Снова открыты: 1 · Закрыты: 3/);
  assert.match(payload.text, /Переоценены среди показанных: 1/);
  assert.match(payload.text, /Среди показанных открытых изменений/);
  assert.doesNotMatch(payload.text, /вакансий для показа нет/);
  assert.match(digestPage(input, 'ru', 4).text, /Закрыты · Исключена/);
});

test('coverage company names and maximal escaped highlights stay bounded in both languages', () => {
  const names = Array.from({ length: 4 }, (_, i) => `${i}${'"'.repeat(159)}`);
  const input = report({ kind: 'first', summary: '"'.repeat(600), counts: { open: Number.MAX_SAFE_INTEGER, new: 0, reopened: 0, closed: 0, pending: Number.MAX_SAFE_INTEGER },
    coverage: { checked: 4, requested: 8, partial: names, failed: names.map((name, i) => `${i + 4}${name.slice(1)}`) },
    jobs: Array.from({ length: 2 }, () => job({ status: 'current', title: '"'.repeat(200), company: '"'.repeat(160), reason: '"'.repeat(400), blocker: '"'.repeat(400) })) });
  for (const ui of ['en', 'ru']) {
    const payload = digestPage(input, ui);
    assert.ok(payload.text.length <= 4096);
    assert.match(payload.text, /… \(\+2\)/);
    assert.doesNotMatch(payload.text.replace(/ href="[^"]*"/gu,''),/"/);
  }
});

test('validates optional automated metadata without adding fields to legacy manual digests', () => {
  assert.deepEqual(Object.keys(normalizeDigest(report())), ['date', 'counts', 'jobs', 'questions']);
  const cases = [{ kind: 'weekly' }, { kind: null }, { kind: 'first' }, { coverage: null },
    { coverage: { checked: -1, requested: 1, partial: [], failed: [] } },
    { coverage: { checked: 2, requested: 1, partial: [], failed: [] } },
    { coverage: { checked: 0.5, requested: 1, partial: [], failed: [] } },
    { coverage: { checked: 1, requested: 1, partial: ['A', 'B'], failed: [] } },
    { coverage: { checked: 1, requested: 1, partial: [], failed: ['A'] } },
    { coverage: { checked: 1, requested: 2, partial: ['A'], failed: ['A'] } },
    { coverage: { checked: 2, requested: 2, partial: ['A', 'A'], failed: [] } },
    { coverage: { checked: 1, requested: 1, partial: [''], failed: [] } },
    { coverage: { checked: 1, requested: 1, partial: [], failed: 'A' } }];
  for (const change of cases) assert.throws(() => normalizeDigest(report(change)), { name: 'TypeError' });
});

test('HR explanation is escaped, visible in overview and available in full on its details page', () => {
  const summary = '<Verified> facts & remaining uncertainties. '.repeat(10);
  const input = report({ summary });
  const overview = digestPage(input);
  assert.match(overview.text, /HR assessment/);
  assert.match(overview.text, /&lt;Verified&gt;/);
  const detail = digestPage(input, 'ru', 1);
  assert.match(detail.text, /Вывод HR-агента/);
  assert.equal((detail.text.match(/&lt;Verified&gt;/gu) || []).length, 10);
  assert.equal(buttons(detail).filter((button) => button.url).length, 0);
  assert.throws(() => normalizeDigest(report({ summary: 'x'.repeat(601) })), { name: 'TypeError' });
});
