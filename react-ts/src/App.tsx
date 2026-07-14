import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/GlobalStyles';
// 레이아웃 컴포넌트들
import MainHeader from './components/MainHeader';
import MainFooter from './components/MainFooter';
import Layout from './components/Layout';

// 페이지 컴포넌트들 (라우트 레벨 코드 스플리팅)
const Home = lazy(() => import('./pages/Home'));
const StockCalc = lazy(() => import('./pages/StockCalc'));
const BacaraCalc = lazy(() => import('./pages/BacaraCalc'));
const AverDownCalc = lazy(() => import('./pages/AverDownCalc'));
const StockAnalysis = lazy(() => import('./pages/StockAnalysis'));
const GridReset = lazy(() => import('./pages/GridReset'));


/**
 * 전체 애플리케이션 레이아웃 래퍼
 * 헤더 + 메인 컨텐츠 + 푸터 구조를 정의
 */
const AppLayout: React.FC = () => (
  <AppContainer>
    <MainHeader />
    <MainContentWrapper>
      <Layout />
    </MainContentWrapper>
    <MainFooter />
  </AppContainer>
);


/**
 * 메인 애플리케이션 컴포넌트
 * 라우팅, 테마, 전역 스타일 설정
 */
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="stock-analysis" element={<StockAnalysis />} />
              <Route path="stockcalc" element={<StockCalc />} />
              <Route path="averdown" element={<AverDownCalc />} />
              <Route path="bacarabet" element={<BacaraCalc />} />
              <Route path="test/grid1" element={<div>그리드1 페이지 (구현 예정)</div>} />
              <Route path="test/grid2" element={<div>그리드2 페이지 (구현 예정)</div>} />
              <Route path="test/grid3" element={<div>그리드3 페이지 (구현 예정)</div>} />
              <Route path="test/grid4" element={<GridReset />} />
              <Route path="signin" element={<div>로그인 페이지 (구현 예정)</div>} />
              <Route path="signup" element={<div>회원가입 페이지 (구현 예정)</div>} />
              <Route path="*" element={<div>페이지를 찾을 수 없습니다.</div>} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
};

export default App;

// =============================================================================
// App 레벨 스타일링
// =============================================================================

import styled from 'styled-components';

/**
 * 전체 앱 컨테이너
 * 화면 전체를 차지하고 헤더/메인/푸터 구조를 잡음
 */
const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: ${({ theme }) => theme.colors.background};
`;

/**
 * 메인 컨텐츠 래퍼
 * 헤더와 푸터 사이의 남은 공간을 모두 차지
 */
const MainContentWrapper = styled.div`
  flex: 1; /* 핵심: 남은 공간을 모두 차지 */
  display: flex;
  flex-direction: column;
`;

const RouteFallback = () => (
  <div role="status" style={{ padding: '2rem', textAlign: 'center' }}>
    콘텐츠를 불러오는 중입니다...
  </div>
);


