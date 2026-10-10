import { execSync } from 'child_process';

const port = parseInt(process.argv[2] || '5000', 10);
if (!port) {
  console.error('Usage: node scripts/free-port.mjs <port>');
  process.exit(1);
}

function pidsOnPort() {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid) pids.add(pid);
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
    return out.split('\n').map((x) => parseInt(x.trim(), 10)).filter(Boolean);
  } catch {
    return [];
  }
}

function procName(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
      const m = out.match(/"([^"]+)"/);
      return m ? m[1].toLowerCase() : '';
    }
    return execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' }).trim().toLowerCase();
  } catch {
    return '';
  }
}

function kill(pid) {
  if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /F`);
  else execSync(`kill ${pid}`);
}

const mine = process.pid;
let freed = 0;
for (const pid of pidsOnPort()) {
  if (pid === mine) continue;
  const name = procName(pid);
  if (name.includes('node')) {
    try {
      kill(pid);
      console.log(`Stopped stale node process ${pid} on port ${port}.`);
      freed++;
    } catch (e) {
      console.error(`Could not stop PID ${pid}: ${e.message}`);
    }
  } else if (name) {
    console.error(`Port ${port} is held by non-node process "${name}" (PID ${pid}) — not touching it.`);
    process.exit(2);
  }
}
if (!freed) console.log(`Port ${port} is free.`);
