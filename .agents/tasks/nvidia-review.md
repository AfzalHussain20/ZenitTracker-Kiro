# NVIDIA NIM provider integration

Adds NVIDIA NIM as a first-priority AI provider for the three reasoning-heavy routes (`jira-insights`, `investigate`, `agent`), routing through `nvidiaWithFallback` when `NVIDIA_API_KEY` or `NVIDIA_API_KEYS` is present and falling back to the existing `geminiWithFallback` chain when NVIDIA is absent or exhausted. The wire format mirrors Groq (OpenAI-compatible), key lifecycle management follows the same `KeyPool` pattern already used for Gemini and Groq, and `getAIProvider()` is untouched. `withTokenTracking` calls in `jira-insights` and `investigate` resolve the model name dynamically from `process.env.NVIDIA_MODEL`, matching the same env var used to set the model in `nvidia.ts`.

**Watch for:**
- The exhaustion retry loop in `nvidiaWithFallback` never calls `markNvidiaExhausted()`, so on a single-key deployment a 429 results in two identical failing requests before falling back to Gemini instead of one — confirmed in `index.ts` lines 76–85.
- The `_provider` variable in `agent/route.ts` resolves correctly but is immediately discarded; `orchestrate()` is called without it, making the NVIDIA selection for the agent route a likely no-op unless `orchestrate` independently calls `getAIProviderFor`.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The key-pool extension is structurally identical to the Gemini and Groq slots. `nvidiaProvider` mirrors `groqProvider` faithfully on the wire and adds runtime-configurable model name and base URL via env vars, which is a useful addition over the static Groq setup.

`nvidiaWithFallback` delegates to `geminiWithFallback.askAI()` once NVIDIA is exhausted, giving a clean three-tier chain. The selection gate in `getAIProviderFor()` checks env var presence and the `NVIDIA_ROUTES` allow-list; `getAIProvider()` is reached otherwise, preserving existing behavior.

The retry loop in `nvidiaWithFallback` has an asymmetry: `nvidiaProvider.askAI()` does call `markNvidiaExhausted()` on 429 before throwing, but the wrapper loop then re-enters and fetches a key again — on a single-key deployment the pool wraps back to the same exhausted key because no available keys remain. The net result is a second failed request before Gemini fallback.

The `agent/route.ts` integration is the weakest point. `getAIProviderFor('agent')` is called and the result stored in `_provider`, but `orchestrate()` receives no provider argument. NVIDIA inference on the agent route only happens if `orchestrate` calls `getAIProviderFor('agent')` internally; if it calls `getAIProvider()` instead, NVIDIA is bypassed entirely for that route.

Both `jira-insights` and `investigate` hardcode the default model string `'nvidia/nemotron-3.5-lightning-30b-a3b'` for token tracking, duplicating the same default in `nvidia.ts`. If one changes, the token-tracking labels silently drift.

---

<details>
<summary>Issues (3)</summary>

1. **NVIDIA exhaustion loop — extra failing request on single-key deployment** — `nvidiaWithFallback` retries up to 2 times on 429. `nvidiaProvider.askAI()` calls `markNvidiaExhausted()` on 429 before throwing, so after iteration 1 the pool index has advanced. On iteration 2 the guard re-calls `getNvidiaKey()`; with one key the pool wraps to the same exhausted slot and fires the same request again. Fix: check `keyPool.getAvailableNvidiaCount() === 0` before the second attempt, or remove the retry loop from `nvidiaWithFallback` entirely — `geminiWithFallback` has its own retry; the wrapper only needs the key-absent guard.

2. **Agent route NVIDIA selection is a no-op** — `agent/route.ts` calls `getAIProviderFor('agent')` and stores the result in `_provider`, then calls `orchestrate()` without it. Whether NVIDIA serves the agent route depends entirely on `orchestrate`'s own provider resolution. Confirmed: `_provider` is never passed to `orchestrate`. Either thread the provider through to `orchestrate`, or make `orchestrate` call `getAIProviderFor('agent')` internally and remove the dead assignment.

3. **Model name default duplicated across three files** — `jira-insights/route.ts` and `investigate/route.ts` both hardcode `'nvidia/nemotron-3.5-lightning-30b-a3b'` as the fallback for `withTokenTracking`; `nvidia.ts` has the same default. Extract to a shared exported constant (`DEFAULT_NVIDIA_MODEL`) in `nvidia.ts` and import it in both route files.

</details>

---

<details>
<summary>Details</summary>

### NVIDIA exhaustion loop and key rotation asymmetry

`nvidiaProvider.askAI()` calls `keyPool.markNvidiaExhausted()` on a 429 before throwing — so after the first failed attempt, the pool's internal index has already advanced. When `nvidiaWithFallback`'s loop continues to iteration 2, it does not call `getNvidiaKey()` again; it reuses the key fetched before the loop. That key is now the exhausted one (the index moved, but the local variable `nvidiaKey` was captured before exhaustion). `nvidiaProvider.askAI()` calls `keyPool.getNvidiaKey()` internally on each call, so iteration 2 actually fetches the next key — but on a single-key deployment, the next key is the same wrapped-around exhausted slot, yielding a second 429. Two failed requests instead of one before Gemini fallback.

```
// current shape — problematic on single-key
const nvidiaKey = keyPool.getNvidiaKey();   // fetched once
if (nvidiaKey) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await nvidiaProvider.askAI(params); }
    catch (err) {
      if (msg.includes('429')) continue;  // markNvidiaExhausted already called inside nvidiaProvider
      throw err;
    }
  }
}
// falls through to geminiWithFallback.askAI()
```

Simplest fix: remove the inner loop. One attempt is sufficient; if NVIDIA throws, fall through to Gemini. The pool's own exhaustion tracking ensures the key won't be reused.

### Agent route provider wiring

```ts
// agent/route.ts
const _provider = getAIProviderFor('agent');   // resolves correctly
const result = await orchestrate({ query, sessionId, ... }); // _provider not passed
```

The leading underscore marks it unused. The practical effect is that the call to `getNvidiaKey()` inside `getAIProviderFor` triggers `keyPool.init()` as a side effect, loading the NVIDIA key pool before `orchestrate` runs. That's a valid rationale if `orchestrate` calls `getAIProviderFor('agent')` internally — but if it calls `getAIProvider()`, NVIDIA is bypassed. This needs a code comment at minimum, and ideally either the provider is passed through or `orchestrate` is updated to call `getAIProviderFor`.

</details>

---

<details>
<summary>File map</summary>

- `src/lib/ai/providers/key-pool.ts` — added `nvidiaKeys` array, `getNvidiaKey()`, `markNvidiaExhausted()`, `getAvailableNvidiaCount()`, updated `getStats()`
- `src/lib/ai/providers/nvidia.ts` — new file; OpenAI-compatible NIM provider with runtime-configurable model, base URL, max tokens, and temperature
- `src/lib/ai/providers/index.ts` — added `nvidiaWithFallback`, `AIRoute` type, `NVIDIA_ROUTES` constant, `getAIProviderFor()` export; `getAIProvider()` unchanged
- `src/app/api/ai/jira-insights/route.ts` — swapped `getAIProvider()` for `getAIProviderFor('jira-insights')`; added dynamic `modelName` for `withTokenTracking`
- `src/app/api/ai/investigate/route.ts` — same swap for `getAIProviderFor('investigate')`; same dynamic `modelName` pattern
- `src/app/api/ai/agent/route.ts` — added import of `getAIProviderFor`; calls it for `'agent'` but result is unused by `orchestrate`

</details>
