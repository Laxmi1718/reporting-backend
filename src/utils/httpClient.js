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
]);

// Direct connection first (works when the backend runs inside the network the CRM
// APIs are actually hosted on). If DNS/connection/TLS fails, retry once through the
// local corporate proxy - needed on dev machines where CRM hosts are only reachable
// via the SWG client, not the regular DNS server / a trusted direct TLS path.
async function getWithProxyFallback(url, config = {}) {
  try {
    return await axios.get(url, config);
  } catch (error) {
    if (!NETWORK_ERROR_CODES.has(error.code)) throw error;

    const agent = getSystemProxyAgent();
    if (!agent) throw error;

    return axios.get(url, { ...config, httpAgent: agent, httpsAgent: agent, proxy: false });
  }
}

module.exports = { getWithProxyFallback };
