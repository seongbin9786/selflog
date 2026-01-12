/**
 * jsonwebtoken vs jose 벤치마크
 * 1. 모듈 로딩 시간 비교
 * 2. Sign/Verify 성능 비교
 */

const ITERATIONS = 1000;
const SECRET = 'my-secret-key-for-testing-purposes';

async function measureLoadTime(moduleName: string): Promise<number> {
  // 캐시 클리어를 위해 새 프로세스에서 측정해야 하지만,
  // 간단히 hrtime으로 첫 require 시간을 측정
  const start = process.hrtime.bigint();
  
  if (moduleName === 'jsonwebtoken') {
    require('jsonwebtoken');
  } else if (moduleName === 'jose') {
    await import('jose');
  }
  
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // ms
}

async function benchmarkJsonwebtoken() {
  const jwt = require('jsonwebtoken');
  
  const payload = { sub: 'user123', username: 'testuser' };
  
  // Sign benchmark
  const signStart = process.hrtime.bigint();
  let token = '';
  for (let i = 0; i < ITERATIONS; i++) {
    token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
  }
  const signEnd = process.hrtime.bigint();
  const signTime = Number(signEnd - signStart) / 1_000_000;
  
  // Verify benchmark
  const verifyStart = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    jwt.verify(token, SECRET);
  }
  const verifyEnd = process.hrtime.bigint();
  const verifyTime = Number(verifyEnd - verifyStart) / 1_000_000;
  
  return {
    sign: signTime / ITERATIONS,
    verify: verifyTime / ITERATIONS,
    token
  };
}

async function benchmarkJose() {
  const { SignJWT, jwtVerify } = await import('jose');
  
  const secret = new TextEncoder().encode(SECRET);
  const payload = { sub: 'user123', username: 'testuser' };
  
  // Sign benchmark
  const signStart = process.hrtime.bigint();
  let token = '';
  for (let i = 0; i < ITERATIONS; i++) {
    token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);
  }
  const signEnd = process.hrtime.bigint();
  const signTime = Number(signEnd - signStart) / 1_000_000;
  
  // Verify benchmark
  const verifyStart = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i++) {
    await jwtVerify(token, secret);
  }
  const verifyEnd = process.hrtime.bigint();
  const verifyTime = Number(verifyEnd - verifyStart) / 1_000_000;
  
  return {
    sign: signTime / ITERATIONS,
    verify: verifyTime / ITERATIONS,
    token
  };
}

async function run() {
  console.log('=== JWT Library Benchmark ===\n');
  console.log(`Iterations: ${ITERATIONS}\n`);
  
  // 모듈 로딩 시간 (별도 프로세스에서 측정해야 정확하지만, 참고용)
  console.log('--- Module Load Time (approximate) ---');
  
  // jsonwebtoken 먼저 로드
  const jwtLoadStart = process.hrtime.bigint();
  const jwt = require('jsonwebtoken');
  const jwtLoadEnd = process.hrtime.bigint();
  const jwtLoadTime = Number(jwtLoadEnd - jwtLoadStart) / 1_000_000;
  console.log(`jsonwebtoken: ${jwtLoadTime.toFixed(3)}ms`);
  
  // jose 로드
  const joseLoadStart = process.hrtime.bigint();
  const jose = await import('jose');
  const joseLoadEnd = process.hrtime.bigint();
  const joseLoadTime = Number(joseLoadEnd - joseLoadStart) / 1_000_000;
  console.log(`jose:         ${joseLoadTime.toFixed(3)}ms`);
  
  console.log(`\nLoad time diff: ${(jwtLoadTime - joseLoadTime).toFixed(3)}ms faster (jose)`);
  
  // 성능 비교
  console.log('\n--- Sign/Verify Performance ---');
  
  const jwtResult = await benchmarkJsonwebtoken();
  console.log(`\njsonwebtoken:`);
  console.log(`  Sign:   ${jwtResult.sign.toFixed(4)}ms per op`);
  console.log(`  Verify: ${jwtResult.verify.toFixed(4)}ms per op`);
  
  const joseResult = await benchmarkJose();
  console.log(`\njose:`);
  console.log(`  Sign:   ${joseResult.sign.toFixed(4)}ms per op`);
  console.log(`  Verify: ${joseResult.verify.toFixed(4)}ms per op`);
  
  console.log('\n--- Summary ---');
  const signDiff = jwtResult.sign / joseResult.sign;
  const verifyDiff = jwtResult.verify / joseResult.verify;
  console.log(`Sign:   jose is ${signDiff.toFixed(2)}x ${signDiff > 1 ? 'faster' : 'slower'}`);
  console.log(`Verify: jose is ${verifyDiff.toFixed(2)}x ${verifyDiff > 1 ? 'faster' : 'slower'}`);
}

run().catch(console.error);
