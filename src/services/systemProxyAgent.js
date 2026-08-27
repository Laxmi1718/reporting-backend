const { execSync } = require('child_process');
const { PacProxyAgent } = require('pac-proxy-agent');

let cachedAgent;

function readAutoConfigUrl() {
  if (process.platform !== 'win32') return null;

  try {
    const output = execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL',
      { encoding: 'utf8', timeout: 5000 }
    );
    const match = output.match(/AutoConfigURL\s+REG_SZ\s+(\S+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Some internal hosts (e.g. Abis Pro CRM) are only reachable through the corporate
// SWG client's local PAC proxy, which also does its own TLS interception - so
// requests tunneled through it need rejectUnauthorized disabled for that hop.
// This is resolved lazily and cached because the proxy's local port changes
// whenever the SWG client restarts.
function getSystemProxyAgent() {
  if (cachedAgent) return cachedAgent;

  const pacUrl = readAutoConfigUrl();
  cachedAgent = pacUrl ? new PacProxyAgent(pacUrl, { rejectUnauthorized: false }) : null;
  return cachedAgent;
}

module.exports = { getSystemProxyAgent };
