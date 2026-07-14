import React, { useEffect } from 'react';
import styled from 'styled-components';

import StockAnalysisApp from '../features/stockAnalysis/App';

const StockAnalysisPage: React.FC = () => {
  useEffect(() => {
    document.title = '종목 분석 - TMPage';
    return () => {
      document.title = 'TMPage';
    };
  }, []);

  return (
    <FullBleedSection role="region" aria-label="종목 분석">
      <PageContainer>
        <StockAnalysisApp />
      </PageContainer>
    </FullBleedSection>
  );
};

export default StockAnalysisPage;

const FullBleedSection = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  background: transparent;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    margin: 0;
    padding: 0;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    margin: 0;
    padding: 0;
  }
`;

const PageContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  padding-top: 16px;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding-top: 14px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding-top: 12px;
  }
`;
