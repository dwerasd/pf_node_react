import React from 'react';
import styled from 'styled-components';
import AverDownCalculator from '../../components/AverDownCalculator';

const AverDownCalc: React.FC = () => {
  return (
    <PageContainer>
      <Header>
        <MainTitle>주식 물타기 / 분할 매수 계산</MainTitle>
        <Description>
          여러 차례 분할 매수(물타기)한 내역을 기반으로 평균 단가와 총 투자 금액을 계산하고, 목표 매도 가격 입력 시 수수료/예상 손익을 즉시 시뮬레이션합니다.
        </Description>
      </Header>
      <Content>
        <AverDownCalculator />
      </Content>
    </PageContainer>
  );
};

export default AverDownCalc;

// 디자인은 StockCalc 페이지 톤과 유사한 블루 그라데이션 유지
const PageContainer = styled.div`
  min-height: 100vh;
  padding: 14px 14px 48px;
  background: linear-gradient(135deg,#153a63 0%,#1e3c72 35%,#2a5298 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Header = styled.div`
  text-align: center;
  margin: 0 0 20px;
  color: #fff;
  width: 100%;
  max-width: 960px;
  padding: 0 4px;
`;

const MainTitle = styled.h1`
  font-size: clamp(1.6rem, 2.2vw + 1rem, 2rem);
  margin: 0 0 8px;
  font-weight: 700;
  letter-spacing: -0.5px;
`;

const Description = styled.p`
  margin: 0 auto;
  max-width: 680px;
  font-size: .85rem;
  line-height: 1.45;
  color: rgba(255,255,255,0.8);
`;

const Content = styled.div`
  width: 100%;
  max-width: 960px; /* 전체 폭 축소 */
  margin: 0 auto;
  padding: 0 4px;

  @media (max-width: 1100px) {
    max-width: 880px;
  }
  @media (max-width: 980px) {
    max-width: 820px;
  }
  @media (max-width: 860px) {
    max-width: 760px;
  }
  @media (max-width: 780px) {
    max-width: 720px;
  }
`;
