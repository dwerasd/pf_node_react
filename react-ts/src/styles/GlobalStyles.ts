import { createGlobalStyle } from 'styled-components';

/**
 * 전역 스타일 정의
 * 애플리케이션 전체에 적용되는 기본 스타일들
 * 브라우저 기본 스타일 리셋 및 공통 스타일 설정
 */
export const GlobalStyles = createGlobalStyle`
  /* CSS Reset - 브라우저 기본 스타일 초기화 */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box; /* 패딩과 테두리를 요소 크기에 포함 */
  }

  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* HTML 및 Body 기본 설정 */
  html {
    font-size: 16px; /* 1rem = 16px */
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    -webkit-text-size-adjust: 100%; /* iOS Safari 텍스트 크기 조정 방지 */
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
                 'Helvetica Neue', Arial, sans-serif; /* 시스템 폰트 사용 */
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text.primary};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    -webkit-font-smoothing: antialiased; /* 폰트 렌더링 개선 (macOS) */
    -moz-osx-font-smoothing: grayscale;  /* 폰트 렌더링 개선 (Firefox) */
  }

  /* 제목 요소들 */
  h1, h2, h3, h4, h5, h6 {
    line-height: ${({ theme }) => theme.typography.lineHeight.tight};
    font-weight: ${({ theme }) => theme.typography.weights.semibold};
    margin: 0;
  }

  /* 문단 */
  p {
    margin: 0;
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  }

  /* 링크 */
  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.secondary};
    }

    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 2px;
    }
  }

  /* 버튼 */
  button {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
  }

  /* 입력 요소들 */
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  /* 이미지 */
  img {
    max-width: 100%;
    height: auto;
    display: block;
  }

  /* 리스트 */
  ul, ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* 접근성 개선: focus 상태 시각화 */
  *:focus {
    outline-offset: 2px;
  }

  /* 접근성: 스크린 리더 전용 텍스트 */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* 스크롤바 스타일링 (Webkit 브라우저) */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.surface};
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.text.secondary};
  }
`;
