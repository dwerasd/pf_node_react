import styled from 'styled-components';

// 기본 컨테이너 - 평단가 계산기와 동일한 크기로 제한
export const Base = styled.div`
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(5px);
  color: #fff;
  padding: 18px 20px 22px;
  border-radius: 14px;
  margin-bottom: 20px;
  width: 95%;
  margin: 0 auto;
  box-sizing: border-box;
  max-width: 760px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.28);
  transition: background .25s ease, border-color .25s ease;

  @media (max-width: 800px) { max-width: 700px; }
  @media (max-width: 740px) { max-width: 640px; }
  @media (max-width: 680px) { max-width: 600px; }
  @media (max-width: 640px) { max-width: 560px; }
  @media (max-width: 600px) { max-width: 520px; padding: 18px 16px 20px; }
  @media (max-width: 560px) { max-width: 480px; }
  @media (max-width: 520px) { max-width: 440px; }
  @media (max-width: 480px) { max-width: 400px; }
  @media (max-width: 440px) { max-width: 360px; padding: 16px 14px 18px; }
  @media (max-width: 400px) { max-width: 340px; }
`;

export const Title = styled.h2`
  color: #fff;
  margin-bottom: 20px;
  text-align: center;
`;

// Form 컨테이너 - 평단가 계산기 스타일에 맞춤
export const Form = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%; // 95%에서 100%로 변경
  // max-width: none, min-width: 800px 제거 - 너무 큰 설정들 삭제
`;

// InputGroup - 평단가 계산기와 유사하게 조정
export const InputGroup = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  width: 100%;
  gap: 10px;
  justify-content: flex-start;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    margin-bottom: 12px;
  }
`;

export const Label = styled.label`
  width: 180px;
  text-align: left;
  color: #eee;
  font-weight: 500;
  flex-shrink: 0;
  font-size: .9rem;

  @media (max-width: 640px) {
    width: 100%;
    font-size: .75rem;
    letter-spacing: .5px;
    text-transform: uppercase;
  }
`;

export const Input = styled.input`
  width: 250px;
  max-width: none;
  padding: 8px;
  margin: 5px 0;
  border: 1px solid rgba(255,255,255,0.28);
  background: rgba(255,255,255,0.14);
  color: #f5f5f5;
  border-radius: 4px;
  font-size: .9rem;
  box-sizing: border-box;
  transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;

  &:hover { background: rgba(255,255,255,0.18); }
  &:focus { outline: none; background: rgba(255,255,255,0.24); border-color: #2196f3; box-shadow: 0 0 0 2px rgba(33,150,243,0.25); }

  @media (max-width: 640px) {
    width: 100%;
    margin: 0;
    font-size: .8rem;
    padding: 7px 8px;
    background: rgba(255,255,255,0.18);
    &:focus { background: rgba(255,255,255,0.28); }
  }
`;

// Button - 크기 조정
export const Button = styled.button`
  padding: 8px 16px;
  background: #444;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.85rem;
  margin-left: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s ease, transform .15s ease;

  &:hover { background: #555; }
  &:active { transform: translateY(1px); }

  @media (max-width: 640px) {
    width: 100%;
    margin-left: 0;
    font-size: .8rem;
    padding: 8px 12px;
  }
`;

// InfoBox - 평단가 계산기의 Result 스타일과 동일하게 조정
export const InfoBox = styled.div`
  margin-top: 15px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
  color: #fff;
  width: 100%;
  font-weight: bold;
  line-height: 1.6;
  font-size: .9rem;

  @media (max-width: 640px) {
    padding: 10px 10px;
    font-size: .8rem;
  }
`;

// ResultBox - 고정 레이아웃으로 변경
export const ResultBox = styled.div`
  margin-top: 15px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
  color: #fff;
  width: 100%;
  font-weight: bold;
  font-size: .9rem;

  > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 40px;
    gap: 12px;
  }

  @media (max-width: 640px) {
    padding: 10px 10px;
    font-size: .8rem;
    > div:first-child { flex-direction: column; align-items: flex-start; gap: 8px; }
  }
`;

// LogBox - 크기 조정
export const LogBox = styled.div`
  margin-top: 20px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
  width: 100%;
  font-size: .85rem;

  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 5px 0; border-bottom: 1px solid #333; word-wrap: break-word; }
  h3 { margin: 0 0 15px; color: #fff; font-size: 1rem; }

  @media (max-width: 640px) {
    font-size: .75rem;
    padding: 10px 10px;
  }
`;

export const ArrayWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
`;

export const GameResultDiv = styled.div`
  margin-top: 15px;
  display: flex;
  gap: 10px; // 15px에서 10px로 줄임
  flex-wrap: wrap; // 작은 화면에서 줄바꿈 허용
  @media (max-width: 640px) { gap: 6px; }
`;

// 하이라이트 스타일들 (기존 유지)
export const HighlightYellow = styled.span`
  background-color: #ffeb3b;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

export const HighlightPink = styled.span`
  background-color: pink;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

export const HighlightBlue = styled.span`
  display: inline-block;
  min-width: 80px;
  text-align: center;
  background-color: lightblue;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

export const HighlightGreen = styled.span`
  background-color: lightgreen;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

export const Highlight = styled.span`
  background-color: #ffeb3b;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

export const AlertHighlight = styled.span`
  background-color: #ff6b6b;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  margin: 0 3px;
  font-weight: 600;
`;

// 텍스트 영역과 버튼 영역을 분리하기 위한 새로운 스타일 추가
export const BetTextArea = styled.div`
  flex: 1; /* 남은 공간 모두 사용 */
  min-width: 0; /* flex-shrink 허용 */
  margin-right: 15px; /* 버튼과의 간격 */
  word-wrap: break-word; /* 긴 텍스트 처리 */
  @media (max-width: 640px) { margin-right: 0; }
`;

export const ButtonArea = styled.div`
  flex-shrink: 0; /* 버튼 영역 크기 고정 */
  white-space: nowrap; /* 줄바꿈 방지 */
  @media (max-width: 640px) { width: 100%; display: flex; gap: 6px; }
`;
