import styled from 'styled-components';

export const Container = styled.div`
  background: rgba(255,255,255,0.09);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(5px);
  box-shadow: 0 6px 18px rgba(0,0,0,0.22);
  color: #fff;
  padding: 18px 20px 22px;
  border-radius: 14px;
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;
  transition: background .25s ease, border-color .25s ease;

  @media (max-width: 640px) {
    padding: 16px 14px 18px;
  }
`;

export const Title = styled.h2`
  color: #fff;
  margin-bottom: 20px;
  text-align: center;
`;

export const Form = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
`;

export const InputGroup = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  width: 100%;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
`;

export const Label = styled.label`
  width: 35%;
  text-align: left;
  margin-right: 10px;
  color: #eee;
  font-weight: 500;

  @media (max-width: 640px) {
    width: 100%;
    margin-right: 0;
    font-size: .75rem;
    letter-spacing: .5px;
    text-transform: uppercase;
  }
`;

export const Input = styled.input`
  width: 60%;
  padding: 8px;
  margin: 5px 0;
  border: 1px solid rgba(255,255,255,0.28);
  background: rgba(255,255,255,0.14);
  color: #f5f5f5;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: .9rem;
  transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
  &:hover { background: rgba(255,255,255,0.18); }
  
  @media (max-width: 640px) {
    width: 100%;
    font-size: .8rem;
    padding: 7px 8px;
    margin: 0;
    background: rgba(255,255,255,0.18);
    &:focus { background: rgba(255,255,255,0.28); }
  }
  
  &:focus {
    outline: none;
    border-color: #4CAF50;
    background: rgba(255,255,255,0.24);
    box-shadow: 0 0 0 2px rgba(76,175,80,0.25);
  }
`;

export const Result = styled.div`
  margin-top: 15px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
  color: #fff;
  width: 100%;
  font-weight: bold;
  font-size: .9rem;

  @media (max-width: 640px) {
    font-size: .8rem;
    padding: 10px 10px;
  }
`;

// 노란색 배경 하이라이트 (저항, 지지용)
export const Highlight = styled.span`
  background-color: #ffeb3b;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

// 빨간색 배경 하이라이트 (위험용)
export const AlertHighlight = styled.span`
  background-color: #ff6b6b;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;
