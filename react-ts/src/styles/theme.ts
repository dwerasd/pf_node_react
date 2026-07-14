/**
 * 디자인 토큰 정의
 * 애플리케이션 전반에서 사용할 일관된 디자인 값들
 */
export const theme = {
  // 컬러 시스템
  colors: {
    primary: '#3fa0b3',           // 메인 브랜드 색상
    secondary: '#2a7a8a',         // 보조 색상 (primary보다 어두운 톤)
    background: '#282c34',        // 배경색 (어두운 회색)
    surface: '#383c44',           // 카드, 패널 등의 배경
    text: {
      primary: '#ffffff',         // 기본 텍스트 (흰색)
      secondary: '#cccccc',       // 보조 텍스트 (연한 회색)
      muted: '#888888'           // 약한 텍스트 (더 어두운 회색)
    },
    border: '#444444',           // 테두리 색상
    hover: 'rgba(63, 160, 179, 0.1)' // 호버 시 배경색
  },

  // 간격 시스템 (8px 기반 그리드)
  spacing: {
    xs: '4px',                   // 매우 작은 간격
    sm: '8px',                   // 작은 간격
    md: '16px',                  // 중간 간격 (기본)
    lg: '24px',                  // 큰 간격
    xl: '32px',                  // 매우 큰 간격
    xxl: '48px'                  // 초대형 간격
  },

  // 타이포그래피 시스템
  typography: {
    sizes: {
      xs: '0.75rem',             // 12px - 매우 작은 텍스트
      sm: '0.875rem',            // 14px - 작은 텍스트
      md: '1rem',                // 16px - 기본 텍스트
      lg: '1.125rem',            // 18px - 큰 텍스트
      xl: '1.25rem',             // 20px - 매우 큰 텍스트
      xxl: '1.5rem'              // 24px - 제목용
    },
    weights: {
      normal: 400,               // 일반 굵기
      medium: 500,               // 중간 굵기
      semibold: 600,             // 세미볼드
      bold: 700                  // 볼드
    },
    lineHeight: {
      tight: 1.2,               // 타이트한 줄간격
      normal: 1.5,              // 일반 줄간격
      relaxed: 1.8              // 여유있는 줄간격
    }
  },

  // 반응형 브레이크포인트
  breakpoints: {
    mobile: '480px',            // 모바일
    tablet: '768px',            // 태블릿
    desktop: '1024px',          // 데스크톱
    wide: '1200px'              // 와이드 스크린
  },

  // 애니메이션 및 트랜지션
  transitions: {
    fast: '0.1s ease-in-out',   // 빠른 애니메이션
    normal: '0.2s ease-in-out', // 일반 애니메이션
    slow: '0.3s ease-in-out'    // 느린 애니메이션
  },

  // 그림자 시스템
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)'
  },

  // 테두리 반경
  borderRadius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
    full: '9999px'              // 완전히 둥근 모서리
  }
} as const;

/**
 * 테마 타입 정의
 * TypeScript에서 테마 객체의 타입을 추론하기 위함
 */
export type Theme = typeof theme;

/**
 * 테마 타입 가드
 * 런타임에서 테마 객체가 유효한지 확인
 */
export const isValidTheme = (obj: any): obj is Theme => {
  return obj && 
         typeof obj.colors === 'object' && 
         typeof obj.spacing === 'object' &&
         typeof obj.typography === 'object';
};
