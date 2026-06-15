const { execSync } = require('child_process');
const http = require('http');

async function main() {
  console.log('[~] Locating running Antigravity Language Server processes...');
  let output = '';
  try {
    output = execSync('powershell -Command "Get-WmiObject Win32_Process -Filter \\"Name like \'%language_server%\'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
  } catch (e) {
    console.error('[-] Failed to query running processes via PowerShell. Make sure you are on Windows.');
    return;
  }

  if (!output.trim()) {
    console.log('[!] No running language server processes found.');
    return;
  }

  let processes;
  try {
    processes = JSON.parse(output);
  } catch (e) {
    console.error('[-] Failed to parse process JSON output.');
    return;
  }

  const procList = Array.isArray(processes) ? processes : [processes];

  for (const proc of procList) {
    if (!proc || !proc.CommandLine) continue;
    const cmd = proc.CommandLine;
    const pid = proc.ProcessId;
    
    // Extract both tokens
    const tokens = [];
    const csrfMatch = cmd.match(/--csrf_token\s+([^\s]+)/);
    if (csrfMatch) tokens.push(csrfMatch[1]);
    const extCsrfMatch = cmd.match(/--extension_server_csrf_token\s+([^\s]+)/);
    if (extCsrfMatch) tokens.push(extCsrfMatch[1]);

    if (tokens.length === 0) {
      continue;
    }

    // Get active listening ports
    let ports = [];
    try {
      const portsOutput = execSync(`powershell -Command "Get-NetTCPConnection -State Listen | Where-Object { $_.OwningProcess -eq ${pid} } | Select-Object -ExpandProperty LocalPort"`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      ports = portsOutput.split(/[\r\n]+/).map(p => p.trim()).filter(Boolean).map(Number);
      ports = [...new Set(ports)];
    } catch (e) {
      continue;
    }

    if (ports.length === 0) {
      continue;
    }

    let found = false;
    for (const port of ports) {
      for (const token of tokens) {
        try {
          const result = await queryServer(port, token);
          formatOutput(result, pid, port);
          found = true;
          break;
        } catch (err) {
          // Silent probe failure
        }
      }
      if (found) break;
    }
  }
}

function formatOutput(result, pid, port) {
  const userStatus = result.userStatus || {};
  const userTier = userStatus.userTier || {};
  
  console.log('\n================================================================');
  console.log('            ANTIGRAVITY MODEL QUOTAS & USER STATUS              ');
  console.log(`            (Process PID: ${pid} | Port: ${port})`);
  console.log('================================================================');
  
  console.log(`User Name   : ${userStatus.name || 'N/A'}`);
  console.log(`User Email  : ${userStatus.email || 'N/A'}`);
  console.log(`User Tier   : ${userTier.name || 'N/A'}`);
  console.log(`Description : ${userTier.description || 'N/A'}`);
  if (userTier.upgradeSubscriptionText) {
    console.log(`Info        : ${userTier.upgradeSubscriptionText}`);
  }
  
  console.log('\nModel Limits & Remaining Quota:');
  console.log('----------------------------------------------------------------');
  
  const cascade = userStatus.cascadeModelConfigData || {};
  const models = cascade.clientModelConfigs;
  
  if (Array.isArray(models) && models.length > 0) {
    models.forEach(model => {
      const label = model.label || 'Unknown Model';
      const quota = model.quotaInfo || {};
      const pct = typeof quota.remainingFraction === 'number' 
        ? `${Math.round(quota.remainingFraction * 100)}%` 
        : 'N/A';
      
      let resetLabel = '';
      if (quota.resetTime) {
        try {
          const date = new Date(quota.resetTime);
          resetLabel = ` (Resets: ${date.toLocaleString()})`;
        } catch (e) {
          resetLabel = ` (Resets: ${quota.resetTime})`;
        }
      }
      
      console.log(`- ${label.padEnd(30)} : ${pct.padEnd(6)} remaining${resetLabel}`);
    });
  } else {
    console.log('[!] No model quota details found in response.');
  }
  console.log('================================================================\n');
}

function queryServer(port, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      metadata: {
        ideName: "antigravity",
        extensionName: "antigravity",
        locale: "en"
      }
    });

    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Codeium-Csrf-Token': token,
        'Connect-Protocol-Version': '1',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body });
          }
        } else {
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

main().catch(console.error);
