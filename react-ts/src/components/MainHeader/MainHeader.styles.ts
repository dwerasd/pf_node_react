import styled from 'styled-components';

/**
 * 헤더 기본 컨테이너
 * 상단에 고정되는 네비게이션 바
 * flexbox를 이용한 좌우 정렬 레이아웃
 */
export const HeaderContainer = styled.header`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000; /* 다른 요소들 위에 표시 */
  min-height: 5vh;
  width: 100%;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  box-sizing: border-box;
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  backdrop-filter: blur(10px); /* 배경 블러 효과 */
  
  /* 반응형 디자인 */
  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: 0 ${({ theme }) => theme.spacing.md};
    min-height: 6vh; /* 모바일에서 터치 영역 확대 */
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 0 ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap; /* 모바일에서 메뉴가 넘칠 경우 줄바꿈 */
  }
`;

/**
 * 좌측 메뉴 영역
 * 홈 링크와 주요 네비게이션 메뉴들
 */
export const LeftMenuSection = styled.nav`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  
  /* 반응형: 모바일에서 스크롤 가능하게 */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    
    &::-webkit-scrollbar {
      display: none; /* Chrome/Safari */
    }
  }
`;

/**
 * 우측 메뉴 영역
 * 로그인, 회원가입 등 사용자 관련 메뉴
 */
export const RightMenuSection = styled.nav`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    margin-top: ${({ theme }) => theme.spacing.xs};
  }
`;

/**
 * 홈 링크 스타일
 * 브랜드 컬러로 강조된 홈 버튼
 */
export const HomeLink = styled.div`
  a {
    color: ${({ theme }) => theme.colors.primary} !important;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    font-size: ${({ theme }) => theme.typography.sizes.lg};
    text-decoration: none;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    transition: all ${({ theme }) => theme.transitions.normal};
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.hover};
      transform: translateY(-1px);
    }
    
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 2px;
    }
  }
`;

/**
 * 일반 메뉴 링크 스타일
 * 기본 네비게이션 링크들의 공통 스타일
 */
export const MenuLink = styled.div`
  a {
    color: ${({ theme }) => theme.colors.text.primary};
    text-decoration: none;
    font-size: ${({ theme }) => theme.typography.sizes.md};
    font-weight: ${({ theme }) => theme.typography.weights.medium};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    transition: all ${({ theme }) => theme.transitions.normal};
    white-space: nowrap; /* 텍스트 줄바꿈 방지 */
    
    /* 기본 상태 */
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
      background-color: ${({ theme }) => theme.colors.hover};
    }
    
    /* 포커스 상태 (접근성) */
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 2px;
      color: ${({ theme }) => theme.colors.primary};
    }
    
    /* 활성 상태 - CSS 모듈의 active 클래스와 함께 사용 */
    &.active {
      color: ${({ theme }) => theme.colors.primary};
      background-color: ${({ theme }) => theme.colors.hover};
      font-weight: ${({ theme }) => theme.typography.weights.bold};
    }
  }
  
  /* 반응형 타이포그래피 */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    a {
      font-size: ${({ theme }) => theme.typography.sizes.sm};
      padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    }
  }
`;

/**
 * 우측 메뉴 전용 스타일
 * 로그인/회원가입 링크의 추가 스타일링
 */
export const AuthMenuLink = styled(MenuLink)`
  a {
    border: 1px solid transparent;
    
    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
    }
    
    /* 회원가입 버튼은 강조 스타일 */
    &[href="/signup"] {
      background-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.background};
      
      &:hover {
        background-color: ${({ theme }) => theme.colors.secondary};
        border-color: ${({ theme }) => theme.colors.secondary};
      }
    }
  }
`;
