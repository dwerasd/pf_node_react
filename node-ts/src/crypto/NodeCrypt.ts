import * as crypto from 'crypto';

export class NodeCrypt {
    private key: Buffer | null = null;
    private initialized: boolean = false;

    constructor(userKey?: string) {
        if (userKey) {
            this.init(userKey);
        }
    }

    /**
     * 키 초기화 - C++과 동일한 SHA256 해싱
     */
    public init(userKey: string): boolean {
        try {
            if (!userKey || userKey.length === 0) {
                this.initialized = false;
                return false;
            }

            // C++과 동일: SHA256으로 키 생성 (32바이트 = AES-256)
            this.key = crypto.createHash('sha256').update(userKey, 'utf8').digest();
            this.initialized = true;
            console.log('🔑 암호화 키 초기화 완료');
            return true;
        } catch (error) {
            console.error('암호화 키 초기화 실패:', error);
            this.initialized = false;
            return false;
        }
    }

    /**
     * 문자열 암호화 (C++ EncryptA와 호환)
     */
    public encryptString(plaintext: string): string {
        if (!this.initialized || !this.key) {
            console.error('암호화가 초기화되지 않았습니다');
            return '';
        }

        try {
            // UTF-8 바이트로 변환
            const plaintextBuffer = Buffer.from(plaintext, 'utf8');

            // 암호화
            const encryptedBuffer = this.encryptBuffer(plaintextBuffer);

            // C++과 동일: Hex 문자열로 변환 (대문자)
            return encryptedBuffer.toString('hex').toUpperCase();
        } catch (error) {
            console.error('문자열 암호화 실패:', error);
            return '';
        }
    }

    /**
     * 문자열 복호화 (C++ DecryptA와 호환)
     */
    /**
   * 문자열 복호화 (디버깅 강화)
   */
    public decryptString(hexCiphertext: string): string {
        if (!this.initialized || !this.key) {
            console.error('암호화가 초기화되지 않았습니다');
            return '';
        }

        try {
            //console.log('복호화 시도 - Hex 길이:', hexCiphertext.length);
            //console.log('Hex preview:', hexCiphertext.substring(0, 50));

            // Hex를 바이너리로 변환
            const ciphertextBuffer = Buffer.from(hexCiphertext, 'hex');
            //console.log('Buffer 변환 성공, 크기:', ciphertextBuffer.length);

            // 복호화
            const decryptedBuffer = this.decryptBuffer(ciphertextBuffer);
            //console.log('복호화 성공, Buffer 크기:', decryptedBuffer.length);

            // UTF-8 문자열로 변환
            const result = decryptedBuffer.toString('utf8');
            //console.log('UTF-8 변환 성공, 문자열 길이:', result.length);
            //console.log('복호화 결과 preview:', result.substring(0, 100));

            return result;
        } catch (error) {
            console.error('문자열 복호화 실패:', error);
            console.error('입력 hex:', hexCiphertext.substring(0, 100));
            return '';
        }
    }


    /**
     * 버퍼 암호화 (C++ Encrypt와 호환) - 수정된 버전
     */
    private encryptBuffer(plaintext: Buffer): Buffer {
        if (!this.key) {
            throw new Error('키가 설정되지 않았습니다');
        }

        try {
            // C++과 동일: 16바이트 IV 생성
            const iv = crypto.randomBytes(16); // AES block size

            // AES-256-CBC 암호화 (수정된 API 사용)
            const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);

            // 암호화 수행
            const encrypted1 = cipher.update(plaintext);
            const encrypted2 = cipher.final();
            const encryptedData = Buffer.concat([encrypted1, encrypted2]);

            // C++과 동일: [IV] + [암호화된 데이터] 형태로 결합
            return Buffer.concat([iv, encryptedData]);
        } catch (error) {
            console.error('버퍼 암호화 오류:', error);
            throw error;
        }
    }

    /**
     * 버퍼 복호화 (C++ Decrypt와 호환) - 수정된 버전
     */
    private decryptBuffer(ciphertext: Buffer): Buffer {
        if (!this.key) {
            throw new Error('키가 설정되지 않았습니다');
        }

        if (ciphertext.length < 16) {
            throw new Error('암호화된 데이터가 너무 짧습니다');
        }

        try {
            // C++과 동일: IV 추출 (첫 16바이트)
            const iv = ciphertext.slice(0, 16);
            const encryptedData = ciphertext.slice(16);

            // AES-256-CBC 복호화 (수정된 API 사용)
            const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);

            // 복호화 수행
            const decrypted1 = decipher.update(encryptedData);
            const decrypted2 = decipher.final();

            return Buffer.concat([decrypted1, decrypted2]);
        } catch (error) {
            console.error('버퍼 복호화 오류:', error);
            throw error;
        }
    }

    /**
     * 암호화 테스트
     */
    public test(): boolean {
        try {
            const testMessage = 'Hello World Test 123';
            //console.log('🧪 암호화 테스트 시작');
            //console.log('원본:', testMessage);

            const encrypted = this.encryptString(testMessage);
            //console.log('암호화:', encrypted);

            const decrypted = this.decryptString(encrypted);
            //console.log('복호화:', decrypted);

            const success = testMessage === decrypted;
            //console.log('테스트 결과:', success ? '✅ 성공' : '❌ 실패');

            return success;
        } catch (error) {
            console.error('암호화 테스트 실패:', error);
            return false;
        }
    }

    /**
     * 리소스 정리
     */
    public destroy(): void {
        if (this.key) {
            this.key.fill(0); // 메모리에서 키 지우기
            this.key = null;
        }
        this.initialized = false;
        console.log('🗑️ 암호화 인스턴스 정리 완료');
    }
}
