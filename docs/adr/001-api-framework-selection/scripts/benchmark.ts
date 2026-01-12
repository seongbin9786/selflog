import { spawn } from 'child_process';
import { createServer } from 'net';

const ITERATIONS = 100;
const NEST_PORT = 3001;
const NEST_BUNDLED_PORT = 3003;
const HONO_PORT = 3002;
const NEST_URL = `http://localhost:${NEST_PORT}`;
const NEST_BUNDLED_URL = `http://localhost:${NEST_BUNDLED_PORT}`;
const HONO_URL = `http://localhost:${HONO_PORT}`;


async function waitForServer(url: string, timeout = 60000) {
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
  throw new Error(`Server at ${url} did not start in ${timeout}ms`);
}


async function measure(url: string, name: string, cold = false) {
  console.log(`\nTesting ${name} (${url})...`);
  
  if (!cold) {
    // Warmup
    console.log('Warmup...');
    try {
        for (let i = 0; i < 10; i++) {
            await fetch(url);
        }
    } catch (e) {
        console.error(`Warmup failed for ${url}`, e);
        return;
    }
  } else {
      console.log('Skipping warmup (Cold start test mode)...');
  }

  console.log(`Running ${ITERATIONS} requests...`);
  const latencies: number[] = [];
  
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    try {
        await fetch(url);
        const end = performance.now();
        const duration = end - start;
        latencies.push(duration);
        if (cold && i === 0) {
            console.log(`\n!!! FIRST REQUEST (Cold Start potential): ${duration.toFixed(2)}ms !!!\n`);
        }
    } catch (e) {
        console.error(`Request failed: ${e}`);
    }
  }

  if (latencies.length === 0) {
      console.log('No successful requests.');
      return;
  }

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  const avg = sum / latencies.length;
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`Results for ${name}:`);
  console.log(`  Avg: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  P50: ${p50.toFixed(2)}ms`);
  console.log(`  P95: ${p95.toFixed(2)}ms`);
  console.log(`  P99: ${p99.toFixed(2)}ms`);
}


async function runLocal(cold: boolean) {
  console.log('Starting local servers and measuring boot time...');
  console.log('(Testing: NestJS dev/prod, Hono dev/prod)\n');
  
  // NestJS (dev mode)
  const nestDevStart = Date.now();
  const nestDev = spawn('pnpm', ['--filter', 'api', 'start:dev'], {
    env: { ...process.env, PORT: String(NEST_PORT) },
    stdio: 'ignore', 
    detached: true 
  });
  const nestDevReadyPromise = waitForServer(NEST_URL).then(() => Date.now() - nestDevStart);


  // NestJS (prod mode)
  const nestProdStart = Date.now();
  const nestProd = spawn('node', ['dist/main.js'], {
    env: { ...process.env, PORT: String(NEST_BUNDLED_PORT), NODE_ENV: 'production' },
    stdio: 'ignore',
    detached: true,
    cwd: process.cwd() + '/apps/api'
  });
  const nestProdReadyPromise = waitForServer(NEST_BUNDLED_URL).then(() => Date.now() - nestProdStart);

  // Hono (dev mode)
  const honoDevStart = Date.now();
  const honoDev = spawn('pnpm', ['--filter', 'my-time-api', 'dev'], {
    env: { ...process.env, PORT: String(HONO_PORT) },
    stdio: 'ignore',
    detached: true
  });
  const honoDevReadyPromise = waitForServer(HONO_URL).then(() => Date.now() - honoDevStart);

  // Hono (prod mode)
  const HONO_PROD_PORT = 3004;
  const HONO_PROD_URL = `http://localhost:${HONO_PROD_PORT}`;
  const honoProdStart = Date.now();
  const honoProd = spawn('node', ['dist/index.js'], {
    env: { ...process.env, PORT: String(HONO_PROD_PORT), NODE_ENV: 'production' },
    stdio: 'ignore',
    detached: true,
    cwd: process.cwd() + '/apps/api'
  });
  const honoProdReadyPromise = waitForServer(HONO_PROD_URL).then(() => Date.now() - honoProdStart);

  const cleanup = () => {
    try { if (nestDev.pid) process.kill(-nestDev.pid); } catch {}
    try { if (nestProd.pid) process.kill(-nestProd.pid); } catch {}
    try { if (honoDev.pid) process.kill(-honoDev.pid); } catch {}
    try { if (honoProd.pid) process.kill(-honoProd.pid); } catch {}
  };
  
  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);

  try {
    const [nestDevBT, nestProdBT, honoDevBT, honoProdBT] = await Promise.all([
      nestDevReadyPromise, 
      nestProdReadyPromise, 
      honoDevReadyPromise,
      honoProdReadyPromise
    ]);
    
    console.log(`\n========== Boot Time Results ==========`);
    console.log(`  NestJS (dev):   ${nestDevBT}ms`);
    console.log(`  NestJS (prod):  ${nestProdBT}ms`);
    console.log(`  Hono (dev):     ${honoDevBT}ms`);
    console.log(`  Hono (prod):    ${honoProdBT}ms`);
    console.log(`----------------------------------------`);
    console.log(`  Prod Boot Time Diff: Hono is ${(nestProdBT / honoProdBT).toFixed(2)}x faster than NestJS`);
    console.log(`========================================\n`);

    await measure(NEST_URL, 'NestJS Dev', cold);
    await measure(NEST_BUNDLED_URL, 'NestJS Prod', cold);
    await measure(HONO_URL, 'Hono Dev', cold);
    await measure(HONO_PROD_URL, 'Hono Prod', cold);
    
  } catch (err) {
    console.error(err);
  } finally {
    cleanup();
    process.exit(0);
  }
}

async function runLambda(nestUrl: string, honoUrl: string, cold: boolean) {
    await measure(nestUrl, 'NestJS (Lambda)', cold);
    await measure(honoUrl, 'Hono (Lambda)', cold);
}

const args = process.argv.slice(2);
const isCold = args.includes('--cold');
const lambdaIndex = args.indexOf('--lambda');

if (lambdaIndex !== -1) {
    const urls = args.slice(lambdaIndex + 1);
    if (urls.length < 2) {
        console.error('Usage: --lambda <NestURL> <HonoURL> [--cold]');
        process.exit(1);
    }
    runLambda(urls[0], urls[1], isCold);
} else {
    runLocal(isCold);
}
