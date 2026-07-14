import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';

/**
 * 레이아웃 컴포넌트의 Props 타입
 */
interface LayoutProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * 애플리케이션 레이아웃 컴포넌트
 * 헤더와 푸터 사이의 메인 컨텐츠 영역을 담당
 * 모든 페이지에서 공통으로 사용되는 레이아웃 구조
 * 
 * 역할:
 * - 헤더/푸터와의 spacing 관리
 * - 스크롤 영역 정의
 * - 반응형 레이아웃 제공
 * - react-router-dom Outlet을 통한 페이지 렌더링
 */
const Layout: React.FC<LayoutProps> = ({ className, children }) => {
  const location = useLocation();
  const isStockAnalysisRoute = React.useMemo(() => {
    return location.pathname.startsWith('/stock-analysis');
  }, [location.pathname]);

  // 개발 환경에서만 생명주기 로깅
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('Layout 컴포넌트 마운트됨');
    }

    return () => {
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.log('Layout 컴포넌트 언마운트됨');
      }
    };
  }, []);

  return (
    <LayoutContainer $isStockAnalysis={isStockAnalysisRoute} className={className} role="main">
      {/* 접근성: 메인 컨텐츠 영역임을 명시 */}
      <ContentArea $isStockAnalysis={isStockAnalysisRoute}>
        {/* 
          children이 있으면 children 렌더링,
          없으면 react-router-dom의 Outlet 사용 (중첩 라우팅)
        */}
        {children || <Outlet />}
      </ContentArea>
    </LayoutContainer>
  );
};

export default Layout;

// =============================================================================
// Styled Components - 레이아웃 스타일링
// =============================================================================

/**
 * 레이아웃 메인 컨테이너
 * MainContentWrapper 내에서 남은 공간을 모두 차지
 */
const GRID_VERTICAL_MARGIN = 16;

const LayoutContainer = styled.main<{ $isStockAnalysis: boolean }>`
  /* 핵심: flex container 내에서 남은 공간 차지 */
  flex: 1;
  
  /* 위치 및 크기 설정 */
  position: relative;
  width: 100%;
  
  /* 헤더가 fixed이므로 상단 마진 필요 (종목분석 제외) */
  margin-top: ${({ $isStockAnalysis }) => ($isStockAnalysis ? '0' : '5vh')};
  margin-bottom: 0;
  padding-top: ${({ $isStockAnalysis }) =>
    $isStockAnalysis ? `max(0px, calc(5vh - ${GRID_VERTICAL_MARGIN}px))` : '0'};
  
  /* 기본 스타일 */
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text.primary};
  
  /* 스크롤 설정 */
  overflow-y: auto;
  overflow-x: hidden;
  
  /* 반응형 디자인 */
  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    margin-top: ${({ $isStockAnalysis }) => ($isStockAnalysis ? '0' : '6vh')};
    padding-top: ${({ $isStockAnalysis }) =>
      $isStockAnalysis ? `max(0px, calc(6vh - ${GRID_VERTICAL_MARGIN}px))` : '0'};
  }
  
  /* 커스텀 스크롤바 (Webkit 기반 브라우저) */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background};
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    
    &:hover {
      background: ${({ theme }) => theme.colors.text.secondary};
    }
  }
`;

/**
 * 실제 컨텐츠가 렌더링되는 영역
 */
const ContentArea = styled.div<{ $isStockAnalysis: boolean }>`
  width: 100%;
  height: 100%; /* min-height 대신 height 100% 사용 */
  padding: ${({ theme, $isStockAnalysis }) => ($isStockAnalysis ? '0' : theme.spacing.lg)};
  box-sizing: border-box;
  
  /* 컨텐츠 간격 설정 */
  > * + * {
    margin-top: ${({ theme }) => theme.spacing.md};
  }
  
  /* 반응형 패딩 */
  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: ${({ theme, $isStockAnalysis }) => ($isStockAnalysis ? '0' : theme.spacing.md)};
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme, $isStockAnalysis }) => ($isStockAnalysis ? '0' : theme.spacing.sm)};
    
    > * + * {
      margin-top: ${({ theme }) => theme.spacing.sm};
    }
  }
`;
