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
  max-width: 600px; /* 데스크탑 기본 폭 */
  width: 100%;
  box-sizing: border-box;
  transition: background .25s ease, border-color .25s ease;

  @media (max-width: 680px) {
    max-width: 100%;
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
`;

export const InputGroup = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 15px;
  width: 100%;
  flex-wrap: wrap;
  gap: 10px;
  position: relative;

  /* range 포함 시 확장 */
  &:has(input[type="range"]) {
    max-width: none;
  }

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    margin-bottom: 14px;
  }
`;

export const Label = styled.label`
  width: 150px; /* 데스크탑 고정 */
  text-align: left;
  color: #eee;
  font-weight: 500;
  flex-shrink: 0;
  font-size: .9rem;

  @media (max-width: 600px) {
    width: 100%;
    font-size: .75rem;
    letter-spacing: .5px;
    text-transform: uppercase;
  }
`;

export const Input = styled.input`
  width: 200px;
  max-width: 300px;
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
  &:focus { outline: none; background: rgba(255,255,255,0.24); border-color: #007bff; box-shadow: 0 0 0 2px rgba(0,123,255,0.25); }

  @media (max-width: 600px) {
    width: 100%;
    max-width: 100%;
    margin: 0;
    font-size: .8rem;
    padding: 7px 8px;
    background: rgba(255,255,255,0.18);
    &:focus { background: rgba(255,255,255,0.28); }
  }
`;

export const ScrollInput = styled.input`
  width: 360px;
  max-width: 410px;
  margin: 10px 0;
  height: 6px;

  &::-webkit-slider-thumb {
    appearance: none; width: 18px; height: 18px; background: #007bff; border-radius: 50%; cursor: pointer;
  }
  &::-webkit-slider-track { background: #555; height: 6px; border-radius: 3px; }

  @media (max-width: 600px) {
    width: 100%;
    max-width: 100%;
  }
`;

export const Description = styled.span`
  color: #999;
  font-size: 0.85em;
  flex: 1;

  @media (max-width: 600px) {
    font-size: .7rem;
    line-height: 1.3;
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

  @media (max-width: 600px) {
    font-size: .8rem;
    padding: 10px 10px;
    margin-top: 10px;
  }
`;

export const HighlightedSpan = styled.span`
  background-color: yellow;
  padding: 2px 5px;
  border-radius: 4px;
  color: black;
  margin: 0 2px;
  font-weight: bold;
`;
