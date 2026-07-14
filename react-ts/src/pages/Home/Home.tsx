import React from 'react';
import styled from 'styled-components';

/**
 * 홈페이지 컴포넌트
 * 사이트의 메인 랜딩 페이지
 * 
 * 이것이 실제 "페이지"입니다.
 * Layout 컴포넌트 내부에서 렌더링됩니다.
 */
const HomePage: React.FC = () => {
  React.useEffect(() => {
    // 페이지별 로직 (예: 페이지뷰 추적, SEO 메타태그 설정 등)
    document.title = 'TMPage - 홈';
    
    console.log('홈페이지 로드됨');
    
    return () => {
      console.log('홈페이지 언마운트됨');
    };
  }, []);

  return (
    <HomeContainer>
      <WelcomeSection>
        <MainTitle>TMPage에 오신 것을 환영합니다</MainTitle>
        <SubTitle>다양한 도구들을 체험해보세요</SubTitle>
      </WelcomeSection>

      <FeatureGrid>
        <FeatureCard>
          <h3>그리드 테스트</h3>
          <p>CSS Grid 레이아웃을 테스트할 수 있는 페이지들</p>
        </FeatureCard>
        
        <FeatureCard>
          <h3>계산기 도구</h3>
          <p>주식 평단가 계산기, 일반 계산기 등 유용한 도구들</p>
        </FeatureCard>
        
        <FeatureCard>
          <h3>게임</h3>
          <p>바카라 시뮬레이션 등 간단한 게임들</p>
        </FeatureCard>
      </FeatureGrid>
    </HomeContainer>
  );
};

export default HomePage;

// =============================================================================
// Styled Components - 홈페이지 전용 스타일
// =============================================================================

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl} 0;
`;

const WelcomeSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
`;

const MainTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.sizes.xxl};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: ${({ theme }) => theme.typography.sizes.xl};
  }
`;

const SubTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.sizes.lg};
  font-weight: ${({ theme }) => theme.typography.weights.normal};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
`;

const FeatureCard = styled.div`
  background-color: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  transition: transform ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  h3 {
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.typography.sizes.lg};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
  
  p {
    color: ${({ theme }) => theme.colors.text.secondary};
    line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  }
`;
