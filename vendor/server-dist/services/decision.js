import { getDb } from '../db/index.js';
import { BEATAPI_BASE_URL } from '../providers/beatapi.js';
import { APINEX_BASE_URL } from '../providers/apinex.js';
import { BLOCKRUN_BASE_URL } from '../providers/blockrun.js';
import { parseRetryAfterMs, parseStatedRetryMs } from '../providers/base.js';
import { RetryHintTracker } from '../lib/retry-hint.js';
import { getClientContext } from '../lib/client-context.js';
import { proxyFetch } from '../lib/proxy.js';
import { recordMonthlyUsage, secondsUntilNextMonth } from './key-budget.js';
import { noteBudgetAlerts } from './budget-alerts.js';
import { reserveProviderCredential } from './provider-credential.js';
import { meterCloudflare, roughTokens } from './cloudflare-neurons.js';
import { isOnCooldown, setCooldown } from './ratelimit.js';
import { markKeyHealthyFromRequest } from './health.js';
// Decision models over the key pool.
//
// A decision model answers typed questions about a piece of state instead of
// generating text: pick one option (choice), yes/no (noul) or a rating on a
// rubric (score), each with probabilities and a confidence. They speak the
// "System One" request shape: { state, questions: { id: { type, instructions,
// criteria } } }.
//
// Decision models are media_models rows with modality = 'decision', maintained
// only by the catalog's `decisionModels` registry (see catalog-sync). They ride
// on keys the user already has for the hosting platform (Cloudflare Workers AI,
// OpenRouter), so there is no separate key to add. They are exposed on
// POST /v1/decisions and are NOT used by the chat router: routing never
// consults them.
//
// Routing within decisions: the requested model, or every enabled decision
// model in priority order for 'auto', then every healthy enabled key of that
// model's platform. A rate-limited or rejected key cools down for that model
// and the chain moves on. Every attempt is logged to decision_requests.
export const DECISION_MODALITY = 'decision';
const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const BAD_KEY_COOLDOWN_MS = 60 * 60_000;
const NO_CREDIT_COOLDOWN_MS = 12 * 60 * 60_000;
const ESTIMATED_TOKENS = 500;
export const DECISION_QUESTION_TYPES = ['choice', 'noul', 'score'];
export const CLAIRIC_MODEL = '@cf/cloudflare/clairic';
export class DecisionError extends Error {
    status;
    code;
    retryAfterMs;
    constructor(message, status, code, retryAfterMs) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterMs = retryAfterMs;
        this.name = 'DecisionError';
    }
}
function parseMeta(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
function allDecisionRows() {
    return getDb()
        .prepare(`SELECT id, platform, model_id, display_name, priority, enabled, quota_label, meta_json
                FROM media_models WHERE modality = ? ORDER BY priority, id`)
        .all(DECISION_MODALITY);
}
/** A back-off stated inside an error body: JSON first (RetryInfo-shaped), the
 *  raw text as prose otherwise. Mirrors buildUpstreamError in providers/base.ts. */
function statedBodyRetryMs(text) {
    try {
        return parseStatedRetryMs(JSON.parse(text));
    }
    catch {
        return parseStatedRetryMs(text);
    }
}
async function upstream(url, platform, init, signal) {
    const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const res = await proxyFetch(url, { ...init, signal: signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal }, platform, 'decision', FETCH_TIMEOUT_MS);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        // Same rule as the chat path (providers/base.ts buildUpstreamError): a
        // header Retry-After wins, then a back-off stated in the error BODY
        // (Gemini RetryInfo, prose "try again in 45 seconds"). Dropping the body
        // hint demotes an exact promise to the 60s heuristic and to no hint.
        throw new DecisionError(`${platform} ${res.status}: ${text.slice(0, 200)}`, res.status, undefined, parseRetryAfterMs(res.headers?.get('retry-after') ?? null) ?? statedBodyRetryMs(text));
    }
    return res.json();
}
function capAsDecisionError(e) {
    return new DecisionError(e.message, 429, 'quota_exceeded', e.retryAfterSec * 1000);
}
function usageOf(raw) {
    const u = (raw ?? {});
    return {
        input_tokens: typeof u.input_tokens === 'number' ? u.input_tokens : 0,
        output_tokens: typeof u.output_tokens === 'number' ? u.output_tokens : 0,
    };
}
function answersOf(raw, platform) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new DecisionError(`${platform} returned no answers`, 502);
    }
    return raw;
}
/** Cloudflare Workers AI keys are stored as "account_id:api_token". */
function cloudflareKey(key) {
    const sep = key.indexOf(':');
    if (sep === -1)
        throw new DecisionError('Cloudflare key must be in format "account_id:api_token"', 401);
    return { accountId: key.slice(0, sep), token: key.slice(sep + 1) };
}
const ADAPTERS = {
    // HAL-X uses `question`, not System One's `instructions`.
    halx: async (_cred, modelId, body, signal) => {
        if (modelId !== 'THX-01')
            throw new DecisionError('Unsupported HAL-X model', 400);
        const questions = Object.fromEntries(Object.entries(body.questions).map(([id, q]) => [id, {
                type: q.type, question: typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions),
                ...(q.criteria === undefined ? {} : { criteria: q.criteria }),
            }]));
        const json = await upstream('https://api.hal-x.ai/v1/systemone', 'halx', {
            method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, state: typeof body.state === 'string' ? body.state : JSON.stringify(body.state), questions }),
        }, signal);
        return checkedDecisionResult(json, 'halx', modelId, body);
    },
    // Explicit model selection is essential: omission invokes the rules engine.
    aisense: async (_cred, modelId, body, signal) => {
        if (!['clef', 'nimble', 'tev1'].includes(modelId))
            throw new DecisionError('Unsupported AI SENSE model', 400);
        const state = body.state && typeof body.state === 'object' && !Array.isArray(body.state)
            ? body.state : { message: body.state };
        const json = await upstream('https://aisenseapi.com/services/v1/decide', 'aisense', {
            method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, state, questions: body.questions }),
        }, signal);
        return checkedDecisionResult(json, 'aisense', modelId, body);
    },
    // The modern BlockRun endpoint uses input + named questions, not the
    // System One wire shape. Keep this free decision route out of chat.
    // Contract: https://blockrun.ai/docs/api-reference/decisions
    blockrun: async (cred, modelId, body, signal) => {
        if (modelId !== 'gpt-6-luna')
            throw new DecisionError('Unsupported BlockRun free decision model', 400);
        const text = (value) => typeof value === 'string' ? value : JSON.stringify(value) ?? '';
        const questions = Object.entries(body.questions).map(([name, question]) => {
            const base = { name, instructions: text(question.instructions) };
            if (question.type === 'noul') {
                return { ...base, type: 'predicate', ...(question.criteria === undefined ? {} :
                        { instructions: `${base.instructions}\nCriteria: ${text(question.criteria)}` }) };
            }
            if (question.type === 'choice') {
                if (!question.criteria || typeof question.criteria !== 'object' || Array.isArray(question.criteria)) {
                    throw new DecisionError('BlockRun choice requires a criteria map', 400);
                }
                const choices = Object.entries(question.criteria).map(([value, description]) => ({ value, description: description == null ? value : text(description) }));
                if (!choices.length)
                    throw new DecisionError('BlockRun choice requires options', 400);
                return { ...base, type: 'choice', choices };
            }
            if (!Array.isArray(question.criteria) || !question.criteria.length) {
                throw new DecisionError('BlockRun score requires an ordered criteria array', 400);
            }
            return { ...base, type: 'score', levels: question.criteria.map((level, i) => ({ label: String(i), description: text(level) })) };
        });
        const json = await upstream(`${BLOCKRUN_BASE_URL}/decisions`, 'blockrun', {
            method: 'POST', redirect: 'error',
            headers: { Authorization: `Bearer ${cred.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, input: text(body.state), questions }),
        }, signal);
        if (!json || json.error || ![modelId, `openai/${modelId}`].includes(String(json.model)) || !Array.isArray(json.answers)) {
            throw new DecisionError('blockrun returned an error, invalid answers or a different decision model', 502);
        }
        const probability = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
        const answers = new Map();
        for (const raw of json.answers) {
            if (!raw || typeof raw !== 'object')
                throw new DecisionError('blockrun returned an invalid answer', 502);
            const a = raw;
            if (typeof a.name !== 'string' || !Object.hasOwn(body.questions, a.name) || answers.has(a.name)) {
                throw new DecisionError('blockrun returned an unexpected or duplicate answer', 502);
            }
            const q = body.questions[a.name];
            if (q.type === 'noul') {
                if (a.type !== 'predicate' || !probability(a.probability))
                    throw new DecisionError('blockrun returned an invalid predicate', 502);
                answers.set(a.name, { type: 'noul', noul: a.probability });
                continue;
            }
            if (a.type !== q.type || !probability(a.confidence) || !Array.isArray(a.probabilities)) {
                throw new DecisionError('blockrun returned an invalid typed answer', 502);
            }
            const allowed = q.type === 'choice' ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
            const probabilities = new Map();
            for (const p of a.probabilities) {
                if (!p || !['string', 'number'].includes(typeof p.value) || !allowed.includes(String(p.value)) ||
                    probabilities.has(String(p.value)) || !probability(p.probability)) {
                    throw new DecisionError('blockrun returned invalid answer probabilities', 502);
                }
                probabilities.set(String(p.value), p.probability);
            }
            if (probabilities.size !== allowed.length)
                throw new DecisionError('blockrun omitted answer probabilities', 502);
            if (q.type === 'choice' ? typeof a.choice !== 'string' || !allowed.includes(a.choice) :
                typeof a.score !== 'number' || !Number.isFinite(a.score) || a.score < 0 || a.score > allowed.length - 1) {
                throw new DecisionError('blockrun returned an out-of-range answer', 502);
            }
            answers.set(a.name, { type: q.type, [q.type]: a[q.type], probabilities: Object.fromEntries(probabilities), confidence: a.confidence });
        }
        if (answers.size !== questions.length)
            throw new DecisionError('blockrun omitted requested answers', 502);
        return { answers: Object.fromEntries(answers), usage: usageOf(json.usage) };
    },
    apinex: async (cred, modelId, body, signal) => {
        const json = await upstream(`${APINEX_BASE_URL}/decisions`, 'apinex', {
            method: 'POST', redirect: 'error',
            headers: { Authorization: `Bearer ${cred.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, state: body.state, questions: body.questions }),
        }, signal);
        if (!json || json.error || json.model !== modelId) {
            throw new DecisionError('apinex returned an error or a different decision model', 502);
        }
        const answers = answersOf(json.answers, 'apinex');
        for (const [id, question] of Object.entries(body.questions)) {
            const answer = answers[id];
            const value = answer?.[question.type];
            if (!answer || answer.type !== question.type || (question.type === 'choice'
                ? typeof value !== 'string'
                : typeof value !== 'number' || !Number.isFinite(value))) {
                throw new DecisionError('apinex returned a missing or invalid typed answer', 502);
            }
        }
        return { answers, usage: usageOf(json.usage) };
    },
    beatapi: async (cred, modelId, body, signal) => {
        const json = await upstream(`${BEATAPI_BASE_URL}/systemone`, 'beatapi', {
            method: 'POST', redirect: 'error',
            headers: { Authorization: `Bearer ${cred.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, state: body.state, questions: body.questions }),
        }, signal);
        if (!json || json.error || json.model !== modelId) {
            throw new DecisionError('beatapi returned an error or a different decision model', 502);
        }
        const answers = answersOf(json.answers, 'beatapi');
        for (const [id, question] of Object.entries(body.questions)) {
            const answer = answers[id];
            const value = answer?.[question.type];
            if (!answer || answer.type !== question.type || (question.type === 'choice'
                ? typeof value !== 'string'
                : typeof value !== 'number' || !Number.isFinite(value))) {
                throw new DecisionError('beatapi returned a missing or invalid typed answer', 502);
            }
        }
        return { answers, usage: usageOf(json.usage) };
    },
    // Workers AI runs Clef through ai/run, with a short `model` selector
    // ("clef-flash") inside the body. Response: { result: { answers, usage } }.
    cloudflare: async (cred, modelId, body, signal) => {
        const { accountId, token } = cloudflareKey(cred.key);
        const selector = modelId.split('/').pop() ?? modelId;
        const payload = JSON.stringify({ model: selector, state: body.state, questions: body.questions });
        const json = await meterCloudflare(cred.key, modelId, { inputTokens: roughTokens(payload) }, () => upstream(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelId}`, 'cloudflare', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: payload,
        }, signal), j => (j?.result ? { inputTokens: usageOf(j.result.usage).input_tokens || roughTokens(payload) } : null), capAsDecisionError);
        if (json?.success === false || !json?.result) {
            throw new DecisionError(`cloudflare: ${json?.errors?.[0]?.message ?? 'no result'}`, 502);
        }
        return { answers: answersOf(json.result.answers, 'cloudflare'), usage: usageOf(json.result.usage) };
    },
    // OpenRouter serves decision models on its alpha decisions endpoint (not
    // under /api/v1), same System One body with the full model id.
    openrouter: async (cred, modelId, body, signal) => {
        const json = await upstream('https://openrouter.ai/api/alpha/decisions', 'openrouter', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cred.key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3001',
                'X-Title': 'FreeLLMAPI',
            },
            body: JSON.stringify({ model: modelId, state: body.state, questions: body.questions }),
        }, signal);
        if (json?.error)
            throw new DecisionError(`openrouter: ${json.error.message ?? 'error'}`, 502);
        return { answers: answersOf(json?.answers, 'openrouter'), usage: usageOf(json?.usage) };
    },
};
/** Platforms with a decision adapter. catalog-sync gates decisionModels rows
 *  on this, the way SEARCH_ENGINE_PLATFORMS gates search rows. */
export const DECISION_PLATFORMS = new Set(Object.keys(ADAPTERS));
function checkedDecisionResult(raw, platform, model, body) {
    const json = raw;
    if (!json || json.error || json.model !== model)
        throw new DecisionError(`${platform} returned a different model or an error`, 502);
    const answers = answersOf(json.answers, platform);
    const probability = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
    for (const [id, question] of Object.entries(body.questions)) {
        const answer = answers[id];
        if (!answer || answer.type !== question.type)
            throw new DecisionError(`${platform} omitted a typed answer`, 502);
        if (question.type === 'choice' ? typeof answer.choice !== 'string' || !question.criteria ||
            !Object.hasOwn(question.criteria, answer.choice) : question.type === 'noul' ? !probability(answer.noul) :
            typeof answer.score !== 'number' || !Number.isFinite(answer.score)) {
            throw new DecisionError(`${platform} returned an invalid answer`, 502);
        }
    }
    return { answers, usage: usageOf(json.usage), ...(typeof json.model_version === 'string' ? { modelVersion: json.model_version } : {}) };
}
/** Clairic extracts typed fields; it cannot answer choice/noul/score questions.
 * Text + numeric fields are the live-tested subset exposed here. */
async function extractClairic(cred, body, signal) {
    const { accountId, token } = cloudflareKey(cred.key);
    const payload = JSON.stringify({ model: 'clairic', state: body.state, fields: body.fields });
    const json = await meterCloudflare(cred.key, CLAIRIC_MODEL, { inputTokens: roughTokens(payload) }, () => upstream(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CLAIRIC_MODEL}`, 'cloudflare', {
        method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: payload,
    }, signal), j => (j?.result ? { inputTokens: usageOf(j.result.usage).input_tokens || roughTokens(payload) } : null), capAsDecisionError);
    if (!json?.success || json.result?.model !== 'clairic')
        throw new DecisionError('cloudflare returned an invalid Clairic result', 502);
    const answers = answersOf(json.result.answers, 'cloudflare');
    for (const [id, field] of Object.entries(body.fields)) {
        const a = answers[id];
        if (!a || a.type !== field.type || !Object.hasOwn(a, 'value') || (a.value !== null &&
            (field.type === 'text' ? typeof a.value !== 'string' : typeof a.value !== 'number' || !Number.isFinite(a.value)))) {
            throw new DecisionError('cloudflare returned an invalid extraction field', 502);
        }
    }
    return { answers, usage: usageOf(json.result.usage), truncated: json.result.truncated === true };
}
// ── Routing ─────────────────────────────────────────────────────────────────
function logDecision(row, keyId, status, latencyMs, questionCount, inputTokens, clientAgent, error) {
    try {
        getDb()
            .prepare(`INSERT INTO decision_requests (model_id, platform, key_id, status, latency_ms, question_count, input_tokens, client_agent, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(row.model_id, row.platform, keyId, status, latencyMs, questionCount, inputTokens, clientAgent, error);
    }
    catch (e) {
        console.error('Failed to log decision request:', e);
    }
    // The per-key monthly caps (#1158) and GET /v1/usage read the
    // key_monthly_usage ledger. Chat, embeddings, media, rerank, moderation and
    // search settle into it through their `requests` rows; decisions log to
    // decision_requests, so a served decision settles its spend directly here.
    // Not a `requests` row: decisions fire every routing turn, and one there
    // would double every chat turn in the dashboard's request analytics.
    if (status === 'ok' && keyId != null) {
        try {
            recordMonthlyUsage(keyId, inputTokens);
            noteBudgetAlerts(keyId);
        }
        catch (e) {
            console.error('Failed to settle decision spend:', e);
        }
    }
}
function coolDown(row, keyId, e) {
    if (e.status === 401 || e.status === 403) {
        setCooldown(row.platform, row.model_id, keyId, BAD_KEY_COOLDOWN_MS);
    }
    else if (e.status === 402) {
        setCooldown(row.platform, row.model_id, keyId, NO_CREDIT_COOLDOWN_MS, 'credit');
    }
    else if (e.status === 429) {
        setCooldown(row.platform, row.model_id, keyId, e.retryAfterMs ?? RATE_LIMIT_COOLDOWN_MS);
    }
}
function hasUsableKey(platform) {
    return !!getDb()
        .prepare("SELECT 1 FROM api_keys WHERE platform = ? AND enabled = 1 AND status IN ('healthy', 'unknown') LIMIT 1")
        .get(platform);
}
/** True when at least one enabled decision model has a usable key. */
export function decisionsAvailable() {
    return allDecisionRows().some(r => r.enabled === 1 && r.model_id !== CLAIRIC_MODEL && ADAPTERS[r.platform] && hasUsableKey(r.platform));
}
function decisionChain(model, skipPlatforms, extraction = false) {
    const enabled = allDecisionRows().filter(r => r.enabled === 1 && ADAPTERS[r.platform] && (r.model_id === CLAIRIC_MODEL) === extraction);
    if (!model || model === 'auto')
        return skipPlatforms ? enabled.filter(r => !skipPlatforms.has(r.platform)) : enabled;
    const pinned = enabled.filter(r => r.model_id === model);
    if (pinned.length === 0) {
        const known = allDecisionRows().some(r => r.model_id === model);
        throw new DecisionError(known
            ? `Decision model '${model}' is turned off. Turn it on from Models → Decision, or use 'auto'.`
            : `Unknown decision model '${model}'. Use 'auto' or a model id from GET /v1/decisions/models.`, 400);
    }
    return pinned;
}
export async function runDecision(body, opts = {}) {
    const extraction = 'fields' in body;
    if (extraction && body.questions !== undefined)
        throw new DecisionError('Send fields or questions, not both', 400);
    if (!extraction && opts.model === CLAIRIC_MODEL)
        throw new DecisionError('Clairic requires fields, not questions', 400);
    if (extraction && opts.model && !['auto', CLAIRIC_MODEL].includes(opts.model))
        throw new DecisionError('This model does not support extraction fields', 400);
    const chain = decisionChain(opts.model, opts.skipPlatforms, extraction);
    const clientAgent = opts.clientAgent !== undefined ? opts.clientAgent : getClientContext().agent;
    const questionCount = Object.keys(extraction ? body.fields : body.questions).length;
    let lastError = null;
    let attempted = 0;
    const hints = new RetryHintTracker();
    for (const row of chain) {
        const tried = new Set();
        for (;;) {
            if (opts.signal?.aborted)
                throw new DecisionError('decision cancelled by the client', 499);
            const { credential, budgetBlocked } = reserveProviderCredential({ platform: row.platform, key_id: null }, ESTIMATED_TOKENS, keyId => tried.has(keyId) || isOnCooldown(row.platform, row.model_id, keyId));
            if (!credential) {
                if (budgetBlocked) {
                    lastError = new DecisionError('Monthly key budget exhausted', 429, 'quota_exceeded');
                    hints.record(429, secondsUntilNextMonth() * 1000);
                }
                break;
            }
            tried.add(credential.id);
            attempted++;
            const started = Date.now();
            try {
                const out = extraction ? await extractClairic(credential, body, opts.signal)
                    : await ADAPTERS[row.platform](credential, row.model_id, body, opts.signal);
                logDecision(row, credential.id, 'ok', Date.now() - started, questionCount, out.usage.input_tokens, clientAgent, null);
                // A served decision is evidence the key works, the same as a served
                // chat request (#1493) or search (#1612). Decision routing fires every
                // turn, so a decision key that serves fine but once got demoted to
                // 'error' by a blip had no way back into the pool.
                markKeyHealthyFromRequest(credential.id);
                return { model: row.model_id, provider: row.platform, ...out };
            }
            catch (err) {
                const e = err instanceof DecisionError ? err : new DecisionError(String(err?.message ?? err), 502);
                logDecision(row, credential.id, 'error', Date.now() - started, questionCount, 0, clientAgent, e.message.slice(0, 300));
                coolDown(row, credential.id, e);
                lastError = e;
                hints.record(e.status, e.retryAfterMs);
                if (opts.signal?.aborted)
                    throw new DecisionError('decision cancelled by the client', 499);
                // A malformed request is the caller's problem, not this key's: move to
                // the next model rather than burning every key on it.
                if (e.status === 400 || e.status === 422)
                    break;
            }
            finally {
                credential.release();
            }
        }
    }
    if (attempted === 0 && !lastError) {
        if (chain.some(row => hasUsableKey(row.platform))) {
            throw new DecisionError('Every decision key is cooling down (rate limited or rejected). Try again later.', 429, 'decision_keys_cooling_down');
        }
        throw new DecisionError('No decision model is available. Add a Cloudflare or OpenRouter key on the Keys page.', 503, 'no_decision_keys');
    }
    // Only statuses the caller can act on pass through: an upstream 401 means
    // OUR provider key failed, not the caller's. A 400 from every model is most
    // likely a malformed request, so it is passed through as one.
    const status = lastError?.status === 429 ? 429 : lastError?.status === 400 || lastError?.status === 422 ? 400 : 502;
    throw new DecisionError(`All decision models failed${lastError ? ` (last: ${lastError.message.slice(0, 160)})` : ' (no usable keys)'}.`, status, lastError?.code, status === 429 ? hints.retryAfterMs() : undefined);
}
export function decisionRetryAfterSec(err) {
    if (err.retryAfterMs !== undefined)
        return Math.ceil(err.retryAfterMs / 1000);
    if (err.code === 'quota_exceeded')
        return secondsUntilNextMonth();
    return undefined;
}
export function listDecisionModels() {
    const db = getDb();
    const platforms = [...DECISION_PLATFORMS];
    const keyRows = db.prepare(`
    SELECT platform, enabled, status FROM api_keys
     WHERE platform IN (${platforms.map(() => '?').join(', ')})
  `).all(...platforms);
    const healthy = (k) => k.enabled === 1 && (k.status === 'healthy' || k.status === 'unknown');
    const monthCounts = new Map(db.prepare(`
      SELECT platform, model_id, COUNT(*) AS n FROM decision_requests
       WHERE status = 'ok' AND created_at >= datetime('now', 'start of month')
       GROUP BY platform, model_id
    `).all().map(r => [`${r.platform}:${r.model_id}`, r.n]));
    return allDecisionRows().map(row => {
        const meta = parseMeta(row.meta_json);
        const keys = keyRows.filter(k => k.platform === row.platform);
        return {
            id: row.id,
            platform: row.platform,
            modelId: row.model_id,
            displayName: row.display_name,
            priority: row.priority,
            enabled: row.enabled === 1,
            quotaLabel: row.quota_label,
            contextWindow: typeof meta.contextWindow === 'number' ? meta.contextWindow : null,
            keyCount: keys.length,
            healthyKeyCount: keys.filter(healthy).length,
            decisionsThisMonth: monthCounts.get(`${row.platform}:${row.model_id}`) ?? 0,
        };
    });
}
/** Turn a decision model on or off. False when the id is not a decision model. */
export function setDecisionModelEnabled(id, enabled) {
    const info = getDb()
        .prepare('UPDATE media_models SET enabled = ? WHERE id = ? AND modality = ?')
        .run(enabled ? 1 : 0, id, DECISION_MODALITY);
    return info.changes > 0;
}
//# sourceMappingURL=decision.js.map