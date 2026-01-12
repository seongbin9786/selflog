import { describe, expect, it } from 'vitest';

import { calculateHashSync } from './HashUtil';

describe('HashUtil', () => {
  describe('calculateHashSync', () => {
    it('동일한 내용은 동일한 해시를 생성해야 함', () => {
      const content = 'Hello, World!';
      const hash1 = calculateHashSync(content);
      const hash2 = calculateHashSync(content);

      expect(hash1).toBe(hash2);
    });

    it('다른 내용은 다른 해시를 생성해야 함', () => {
      const content1 = 'Hello, World!';
      const content2 = 'Hello, World!!';

      const hash1 = calculateHashSync(content1);
      const hash2 = calculateHashSync(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('빈 문자열도 해시를 생성해야 함', () => {
      const hash = calculateHashSync('');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('여러 줄 텍스트도 처리해야 함', () => {
      const content = `09:00 회의
10:00 개발
11:00 점심`;

      const hash = calculateHashSync(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('특수문자가 포함된 내용도 처리해야 함', () => {
      const content = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const hash = calculateHashSync(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('한글 내용도 처리해야 함', () => {
      const content = '안녕하세요. 한글 테스트입니다.';

      const hash = calculateHashSync(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('이모지가 포함된 내용도 처리해야 함', () => {
      const content = '😀 👍 🎉';

      const hash = calculateHashSync(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('공백의 차이를 감지해야 함', () => {
      const content1 = 'Hello World';
      const content2 = 'Hello  World'; // 공백 2개

      const hash1 = calculateHashSync(content1);
      const hash2 = calculateHashSync(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('줄바꿈의 차이를 감지해야 함', () => {
      const content1 = 'Line1\nLine2';
      const content2 = 'Line1\n\nLine2';

      const hash1 = calculateHashSync(content1);
      const hash2 = calculateHashSync(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('대소문자의 차이를 감지해야 함', () => {
      const content1 = 'hello';
      const content2 = 'Hello';

      const hash1 = calculateHashSync(content1);
      const hash2 = calculateHashSync(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('16진수 문자열 형식이어야 함', () => {
      const content = 'Test content';
      const hash = calculateHashSync(content);

      // 16진수 문자열인지 확인
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('긴 텍스트도 처리해야 함', () => {
      const content = 'A'.repeat(10000);
      const hash = calculateHashSync(content);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });
});
