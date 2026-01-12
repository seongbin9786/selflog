const fs = require('fs');
const Module = require('module');

const originalRequire = Module.prototype.require;
const stats = [];

Module.prototype.require = function (path) {
  const start = process.hrtime();
  const result = originalRequire.apply(this, arguments);
  const diff = process.hrtime(start);
  const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
  
  // node_modules 내부 모듈만 기록
  if (!path.startsWith('./') && !path.startsWith('../') && !path.startsWith('/')) {
      stats.push({ path, duration: durationMs });
  }
  return result;
};

require('../apps/api/dist/index.js');

// 서버가 시작되고 나면 통계 출력 후 종료 (index.js가 실행되면 서버가 뜨므로)
setTimeout(() => {
    stats.sort((a, b) => b.duration - a.duration);
    console.log('\n===== Top 20 Slowest Requires =====');
    stats.slice(0, 20).forEach((s, i) => {
        console.log(`${i+1}. ${s.path}: ${s.duration.toFixed(3)}ms`);
    });
    process.exit(0);
}, 2000);
