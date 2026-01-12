import { spawn } from 'child_process';

const ITERATIONS = 20; // NestJS는 느리니까 20번만
const PORT = 3007;
const URL = `http://localhost:${PORT}`;

async function waitForServer(url: string, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Server did not start in ${timeout}ms`);
}

async function measureBoot() {
    const start = Date.now();
    const child = spawn('node', ['dist/main.js'], {
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
        stdio: 'ignore',
        cwd: process.cwd() + '/apps/api'
    });

    try {
        await waitForServer(URL);
        const duration = Date.now() - start;
        return { duration, child };
    } catch (e) {
        child.kill(); // 그룹 킬 대신 단순 킬
        throw e;
    }
}

async function run() {
    console.log(`Profiling NestJS Prod Boot Time (${ITERATIONS} iterations)...`);
    
    const durations: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
        process.stdout.write(`\rIteration ${i + 1}/${ITERATIONS}`);
        try {
            const { duration, child } = await measureBoot();
            durations.push(duration);
            child.kill();
            await new Promise(r => setTimeout(r, 100)); 
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
    
    console.log(`\nNestJS Boot Time Statistics:`);
    console.log(`  Avg: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);
    console.log(`  P50: ${p50.toFixed(2)}ms`);
}

run();
