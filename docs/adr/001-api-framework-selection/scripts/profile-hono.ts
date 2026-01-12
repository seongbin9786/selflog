import { spawn } from 'child_process';

const ITERATIONS = 100; // 100번 반복
const PORT = 3005;
const URL = `http://localhost:${PORT}`;

async function waitForServer(url: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 10)); // 10ms 단위로 체크
  }
  throw new Error(`Server did not start in ${timeout}ms`);
}

async function measureBoot() {
    const start = Date.now();
    const child = spawn('node', ['apps/api/dist/index.js'], {
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
        stdio: 'ignore' 
    });

    try {
        await waitForServer(URL);
        const duration = Date.now() - start;
        return { duration, child };
    } catch (e) {
        if (child.pid) process.kill(-child.pid);
        throw e;
    }
}

async function run() {
    console.log(`Profiling Hono Prod Boot Time (${ITERATIONS} iterations)...`);
    
    const durations: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
        process.stdout.write(`\rIteration ${i + 1}/${ITERATIONS}`);
        try {
            const { duration, child } = await measureBoot();
            durations.push(duration);
            child.kill();
            // 포트 반환 대기
            await new Promise(r => setTimeout(r, 50)); 
        } catch (e) {
            console.error(`\nFailed at iteration ${i}:`, e);
        }
    }
    console.log('\nDone.');

    if (durations.length === 0) return;

    durations.sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = durations[0];
    const max = durations[durations.length - 1];
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    console.log(`\nHono Boot Time Statistics:`);
    console.log(`  Avg: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);
    console.log(`  P50: ${p50.toFixed(2)}ms`);
    console.log(`  P95: ${p95.toFixed(2)}ms`);
    console.log(`  P99: ${p99.toFixed(2)}ms`);
}

run();
