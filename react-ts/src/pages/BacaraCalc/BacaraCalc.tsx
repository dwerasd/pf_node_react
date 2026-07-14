import React from 'react';
import styled from 'styled-components';

import BacaraBet from '../../components/BacaraBet';

const BacaraCalc: React.FC = () => {
  return (
    <Container>
      <Header>
        <MainTitle>바카라 베팅 가이드</MainTitle>
        <Description>
           바카라용 라브셰르 베팅 가이드 입니다. 
        </Description>
      </Header>
      
      <ContentContainer>
        <BacaraBet />
      </ContentContainer>
    </Container>
  );
};

export default BacaraCalc;

// 스타일 정의 - 바카라 테마
const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #2c1810 0%, #8b4513 50%, #d2691e 100%);
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
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  color: #ffd700; /* 골드 색상으로 카지노 느낌 */
`;

const Description = styled.p`
  font-size: 1.1em;
  color: rgba(255, 255, 255, 0.9);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
`;

const ContentContainer = styled.div`
  max-width: 1200px;
  width: 95%; /* 추가: 좁은 화면 대응 */
  margin: 0 auto;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 15px;
  padding: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 215, 0, 0.2);
  
  /* 모바일 대응 */
  @media (max-width: 768px) {
    width: 98%;
    padding: 10px;
    border-radius: 8px;
  }
  
  @media (max-width: 480px) {
    width: 100%;
    padding: 5px;
    margin: 0 5px;
  }
`;