import React, { useState } from 'react';
import styled from 'styled-components';

import AveragePriceCalculator from '../../components/AveragePriceCalculator'
import PriceConverter from '../../components/PriceConverter';
import HighLowAnalyzer from '../../components/HighLowAnalyzer';

type TabType = 'average' | 'converter' | 'analyzer';

const StockCalc: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('average');

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'average':
        return <AveragePriceCalculator />;
      case 'converter':
        return <PriceConverter />;
      case 'analyzer':
        return <HighLowAnalyzer />;
      default:
        return <AveragePriceCalculator />;
    }
  };

  return (
    <Container>
      <Header>
        <MainTitle>주식 계산기 모음</MainTitle>
        <Description>
          주식 투자에 필요한 다양한 계산기를 제공합니다. 
        </Description>
      </Header>
      
      <TabContainer>
        <Tab 
          $active={activeTab === 'average'} 
          onClick={() => setActiveTab('average')}
        >
          평단가 계산기
        </Tab>
        <Tab 
          $active={activeTab === 'converter'} 
          onClick={() => setActiveTab('converter')}
        >
          가격 전환 계산기
        </Tab>
        <Tab 
          $active={activeTab === 'analyzer'} 
          onClick={() => setActiveTab('analyzer')}
        >
          고가-저가 분석기
        </Tab>
      </TabContainer>
      
      <ContentContainer>
        {renderActiveComponent()}
      </ContentContainer>
    </Container>
  );
};

export default StockCalc;

// 스타일 정의
const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  padding: 20px;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 30px;
  color: white;
`;

const MainTitle = styled.h1`
  font-size: 2.5em;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
`;

const Description = styled.p`
  font-size: 1.1em;
  color: rgba(255, 255, 255, 0.8);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
`;

const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  gap: 10px;
  flex-wrap: wrap;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 24px;
  border: none;
  border-radius: 25px;
  background: ${props => props.$active ? '#fff' : 'rgba(255, 255, 255, 0.2)'};
  color: ${props => props.$active ? '#1e3c72' : '#fff'};
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1em;
  
  &:hover {
    background: ${props => props.$active ? '#fff' : 'rgba(255, 255, 255, 0.3)'};
    transform: translateY(-2px);
  }
`;

const ContentContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;
