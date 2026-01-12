/**
 * LocalStorage 관리를 위한 제네릭 클래스
 * 타입 안전성과 에러 핸들링을 제공합니다.
 */
export class LocalStorageManager<T> {
  constructor(
    private key: string,
    private defaultValue: T,
  ) {}

  /**
   * LocalStorage에서 값을 로드합니다.
   * 실패 시 defaultValue를 반환합니다.
   */
  load(): T {
    try {
      const stored = localStorage.getItem(this.key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
      return this.defaultValue;
    } catch (error) {
      console.error(`Failed to load ${this.key} from localStorage:`, error);
      return this.defaultValue;
    }
  }

  /**
   * LocalStorage에 값을 저장합니다.
   */
  save(value: T): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${this.key} to localStorage:`, error);
    }
  }

  /**
   * LocalStorage에서 값을 제거합니다.
   */
  clear(): void {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error(`Failed to clear ${this.key} from localStorage:`, error);
    }
  }
}
