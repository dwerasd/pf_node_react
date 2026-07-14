import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * 압축 파일 MIME 타입 화이트리스트
 * 일반적인 압축 형식들만 허용
 */
const allowedCompressMimes = [
  // ZIP 계열
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  
  // 7Z 계열
  'application/x-7z-compressed',
  'application/x-7z',
  
  // RAR 계열
  'application/x-rar-compressed',
  'application/x-rar',
  'application/vnd.rar',
  
  // TAR 계열
  'application/x-tar',
  'application/tar',
  
  // GZIP 계열
  'application/gzip',
  'application/x-gzip',
  
  // BZIP2 계열
  'application/x-bzip2',
  'application/bzip2',
  
  // XZ 계열
  'application/x-xz',
  
  // 기타 압축 형식
  'application/x-compress',
  'application/x-compressed',
  
  // 일부 브라우저에서 잘못 감지하는 경우
  'application/octet-stream' // 이건 확장자로 추가 검증 필요
];

/**
 * 압축 파일 확장자 화이트리스트 (소문자)
 * 분할 압축 파일 형식 포함
 */
const allowedCompressExtensions = [
  // 기본 압축 형식
  '.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.lz', '.lzma',
  
  // 분할 압축 파일 (숫자 패턴)
  '.z01', '.z02', '.z03', '.z04', '.z05', '.z06', '.z07', '.z08', '.z09',
  '.z10', '.z11', '.z12', '.z13', '.z14', '.z15', '.z16', '.z17', '.z18', '.z19', '.z20',
  
  // 001, 002 형식 분할
  '.001', '.002', '.003', '.004', '.005', '.006', '.007', '.008', '.009',
  '.010', '.011', '.012', '.013', '.014', '.015', '.016', '.017', '.018', '.019', '.020',
  
  // part 형식 분할
  '.part1', '.part2', '.part3', '.part4', '.part5', '.part6', '.part7', '.part8', '.part9',
  '.part01', '.part02', '.part03', '.part04', '.part05', '.part06', '.part07', '.part08', '.part09',
  
  // WinRAR 분할 형식
  '.r00', '.r01', '.r02', '.r03', '.r04', '.r05', '.r06', '.r07', '.r08', '.r09',
  
  // 추가 압축 형식
  '.tgz', '.tar.gz', '.tar.bz2', '.tar.xz', '.tbz2', '.txz',
  
  // 압축된 아카이브 형식
  '.cab', '.arj', '.ace', '.lha', '.lzh'
];

/**
 * 위험한 실행 가능 파일 확장자 블랙리스트
 * 이런 확장자는 압축 파일 내부에 있어도 위험할 수 있지만, 
 * 압축 파일 자체의 확장자로는 절대 허용하지 않음
 */
const dangerousExtensions = [
  // Windows 실행 파일
  '.exe', '.com', '.scr', '.bat', '.cmd', '.pif', '.vbs', '.vbe', '.js', '.jse',
  '.wsf', '.wsh', '.msi', '.msp', '.hta', '.cpl', '.jar',
  
  // 스크립트 파일
  '.php', '.php3', '.php4', '.php5', '.phtml', '.asp', '.aspx', '.jsp',
  '.pl', '.py', '.rb', '.sh', '.ps1', '.psm1',
  
  // 라이브러리/동적 링크
  '.dll', '.sys', '.drv', '.ocx',
  
  // 매크로 포함 문서 (위험할 수 있음)
  '.docm', '.xlsm', '.pptm', '.dotm', '.xltm', '.potm',
  
  // 기타 위험 형식
  '.reg', '.inf', '.scf', '.lnk', '.url'
];

/**
 * 파일 확장자가 분할 압축 패턴인지 검사
 * z01~z99, 001~999, part1~part99 등 동적 패턴 매칭
 */
function isValidSplitArchiveExtension(extension: string): boolean {
  const lowerExt = extension.toLowerCase();
  
  // 이미 화이트리스트에 있는 경우
  if (allowedCompressExtensions.includes(lowerExt)) {
    return true;
  }
  
  // 동적 패턴 검사
  const patterns = [
    /^\.z\d{2}$/, // .z01, .z02, ..., .z99
    /^\.z\d{3}$/, // .z001, .z002, ..., .z999
    /^\.\d{3}$/, // .001, .002, ..., .999
    /^\.part\d{1,3}$/, // .part1, .part2, ..., .part999
    /^\.part\d{2}$/, // .part01, .part02, ..., .part99
    /^\.r\d{2}$/, // .r00, .r01, ..., .r99
    /^\.v\d{2}$/, // .v01, .v02, ..., .v99 (일부 압축 도구)
    /^\.s\d{2}$/ // .s01, .s02, ..., .s99 (일부 압축 도구)
  ];
  
  return patterns.some(pattern => pattern.test(lowerExt));
}

/**
 * 파일 필터링 함수
 * 압축 파일만 허용하고 위험한 파일은 차단
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const originalName = file.originalname.toLowerCase();
  const fileExtension = path.extname(originalName);
  const mimeType = file.mimetype.toLowerCase();
  
  // 1단계: 위험한 확장자 블랙리스트 검사 (최우선)
  if (dangerousExtensions.includes(fileExtension)) {
    const error = new Error(`Dangerous file type detected: ${fileExtension}`);
    (error as any).code = 'DANGEROUS_FILE_TYPE';
    cb(error as any, false); // Error 타입을 any로 캐스팅하여 타입 에러 해결
    return;
  }
  
  // 2단계: 압축 파일 확장자 검사
  const isValidExtension = allowedCompressExtensions.includes(fileExtension) || 
                          isValidSplitArchiveExtension(fileExtension);
  
  if (!isValidExtension) {
    const error = new Error(`Only compressed archive files are allowed. Got: ${fileExtension}`);
    (error as any).code = 'INVALID_EXTENSION';
    cb(error as any, false); // Error 타입을 any로 캐스팅하여 타입 에러 해결
    return;
  }
  
  // 3단계: MIME 타입 검사 (octet-stream은 추가 검증 필요)
  if (mimeType === 'application/octet-stream') {
    // octet-stream인 경우 확장자로만 판단 (이미 위에서 검증됨)
    console.log(`File ${originalName} detected as octet-stream, validating by extension only`);
    cb(null, true);
    return;
  }
  
  if (!allowedCompressMimes.includes(mimeType)) {
    const error = new Error(`Invalid MIME type for compressed file: ${mimeType}`);
    (error as any).code = 'INVALID_MIME_TYPE';
    cb(error as any, false); // Error 타입을 any로 캐스팅하여 타입 에러 해결
    return;
  }
  
  // 4단계: 파일명 안전성 검사
  if (originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
    const error = new Error('Invalid filename: path traversal detected');
    (error as any).code = 'INVALID_FILENAME';
    cb(error as any, false); // Error 타입을 any로 캐스팅하여 타입 에러 해결
    return;
  }
  
  // 5단계: 파일명 길이 검사 (255자 제한)
  if (originalName.length > 255) {
    const error = new Error('Filename too long (max 255 characters)');
    (error as any).code = 'FILENAME_TOO_LONG';
    cb(error as any, false); // Error 타입을 any로 캐스팅하여 타입 에러 해결
    return;
  }
  
  // 모든 검증 통과
  console.log(`File upload approved: ${originalName} (${mimeType})`);
  cb(null, true);
};

// Multer 스토리지 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // UUID로 파일명 생성하되 원본 확장자는 유지
    const uuid = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${uuid}${extension}`;
    
    // 보안 로깅
    console.log(`File stored as: ${filename} (original: ${file.originalname})`);
    cb(null, filename);
  }
});

// Multer 설정
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB 제한 (압축 파일은 클 수 있음)
    fieldSize: 10 * 1024 * 1024,   // 10MB 필드 크기 제한
    files: 1, // 한 번에 1개 파일만 업로드
    fields: 10 // 최대 10개 필드
  }
});

/**
 * 업로드된 파일이 실제 압축 파일인지 헤더를 통해 추가 검증
 * 파일 시그니처 (매직 넘버)로 실제 형식 확인
 * 
 * fs.readFileSync는 start/end 옵션을 지원하지 않으므로 
 * 낮은 수준의 파일 I/O나 전체 파일 읽기 후 슬라이스를 사용
 */
export function validateArchiveHeader(filePath: string): { isValid: boolean; detectedType: string | null } {
  try {
    // 방법 1: 전체 파일을 읽고 슬라이스 (작은 파일에 적합)
    const stats = fs.statSync(filePath);
    if (stats.size > 1024 * 1024) { // 1MB보다 큰 파일은 처음 부분만 읽기
      // 방법 2: 낮은 수준의 파일 I/O 사용
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(10); // 처음 10바이트만 읽을 버퍼 할당
      fs.readSync(fd, buffer, 0, 10, 0); // 파일의 0번째 위치부터 10바이트 읽기
      fs.closeSync(fd);
      
      return checkArchiveSignature(buffer);
    } else {
      // 작은 파일은 전체를 읽고 슬라이스
      const fullBuffer = fs.readFileSync(filePath);
      const buffer = fullBuffer.subarray(0, 10); // 처음 10바이트만 추출
      
      return checkArchiveSignature(buffer);
    }
    
  } catch (error) {
    console.error('Archive header validation failed:', error);
    return { isValid: false, detectedType: null };
  }
}

/**
 * 압축 파일 시그니처를 검사하는 헬퍼 함수
 * 매직 넘버를 통해 실제 파일 형식을 판별
 */
function checkArchiveSignature(buffer: Buffer): { isValid: boolean; detectedType: string | null } {
  // 주요 압축 파일 시그니처 검사
  const signatures = [
    { signature: [0x50, 0x4B], type: 'ZIP', name: 'ZIP Archive' }, // ZIP
    { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], type: '7Z', name: '7-Zip Archive' }, // 7Z
    { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], type: 'RAR', name: 'RAR Archive (old)' }, // RAR 4.x
    { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01], type: 'RAR', name: 'RAR Archive (new)' }, // RAR 5.0+
    { signature: [0x1F, 0x8B], type: 'GZIP', name: 'GZIP Archive' }, // GZIP
    { signature: [0x42, 0x5A, 0x68], type: 'BZIP2', name: 'BZIP2 Archive' }, // BZIP2
    { signature: [0xFD, 0x37, 0x7A, 0x58, 0x5A], type: 'XZ', name: 'XZ Archive' } // XZ
  ];
  
  for (const { signature, type, name } of signatures) {
    if (buffer.length >= signature.length) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return { isValid: true, detectedType: `${type} (${name})` };
      }
    }
  }
  
  // 시그니처가 매칭되지 않는 경우
  return { isValid: false, detectedType: null };
}

/**
 * 허용된 압축 파일 형식 목록 반환 (API 문서용)
 */
export function getAllowedFormats(): { extensions: string[]; mimeTypes: string[]; splitPatterns: string[] } {
  return {
    extensions: allowedCompressExtensions,
    mimeTypes: allowedCompressMimes,
    splitPatterns: [
      '.z01~.z99 (분할 ZIP)',
      '.001~.999 (숫자 분할)',
      '.part1~.part99 (Part 분할)',
      '.r00~.r99 (RAR 분할)'
    ]
  };
}
