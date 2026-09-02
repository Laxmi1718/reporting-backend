const axios = require('axios');
const { getSystemProxyAgent } = require('../services/systemProxyAgent');

const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNREFUSED',
  // The corporate SWG client TLS-inspects some/all outbound HTTPS traffic on this
  // network; when it does, Node rejects the inspection cert since it isn't in its
  // trusted CA store. Both mean "route this through the SWG's own proxy instead".
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  // Some hosts (e.g. the Traders CRM API) are silently black-holed on the direct
  // path instead of actively refused - the connection just hangs until axios's own
  // `timeout` fires as ECONNABORTED, never an OS-level error. That hang is the same
  // "needs the SWG proxy instead" signal as the codes above, just detected client-side.
  'ECONNABORTED',
]);

// A host that's actually reachable directly responds in well under this; a host
// that's black-holed by network policy never responds at all, no matter how long
// we wait. So the direct attempt gets a short leash - burning the caller's full
// timeout (often 30000ms) on a connection that was never going to succeed is what
// pushed some CRM modules past the frontend's 60s budget once the proxy retry
// (which uses the caller's real timeout) was added on top.
const DIRECT_ATTEMPT_TIMEOUT_MS = 6000;

// Direct connection first (works when the backend runs inside the network the CRM
// APIs are actually hosted on). If DNS/connection/TLS fails, retry once through the
// local corporate proxy - needed on dev machines where CRM hosts are only reachable
// via the SWG client, not the regular DNS server / a trusted direct TLS path.
//
// `retryOptions.retries` adds extra attempts through the proxy leg alone (never
// repeats the direct attempt - once a network error puts us on the proxy path,
// direct is known not to work for this host) for vendors measured to be
// intermittently slow/flaky even over the proxy (e.g. Traders CRM). Each retry
// uses `retryOptions.retryTimeout` (falling back to `config.timeout`) - keep the
// combined worst case (direct + first proxy attempt + retries) comfortably under
// the caller's own overall budget.
async function getWithProxyFallback(url, config = {}, retryOptions = {}) {
  const { retries = 0, retryTimeout } = retryOptions;

  try {
    const directTimeout = Math.min(config.timeout ?? DIRECT_ATTEMPT_TIMEOUT_MS, DIRECT_ATTEMPT_TIMEOUT_MS);
    return await axios.get(url, { ...config, timeout: directTimeout });
  } catch (error) {
    if (!NETWORK_ERROR_CODES.has(error.code)) throw error;

    const agent = getSystemProxyAgent();
    if (!agent) throw error;

    const proxyConfig = { ...config, httpAgent: agent, httpsAgent: agent, proxy: false };

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const timeout = attempt === 0 ? config.timeout : (retryTimeout ?? config.timeout);
        return await axios.get(url, { ...proxyConfig, timeout });
      } catch (proxyError) {
        lastError = proxyError;
      }
    }
    throw lastError;
  }
}

module.exports = { getWithProxyFallback };
