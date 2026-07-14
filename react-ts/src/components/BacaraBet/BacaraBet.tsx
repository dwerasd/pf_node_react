import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Base,
  Title,
  Form,
  InputGroup,
  Label,
  Input,
  Button,
  InfoBox,
  HighlightYellow,
  HighlightPink,
  HighlightBlue,
  HighlightGreen,
  ResultBox,
  LogBox,
  ArrayWrapper,
  GameResultDiv,
  BetTextArea,
  ButtonArea
} from './BacaraBet.styles';

// 베팅 결과 타입 정의
type BetResult = 'B' | 'P';

const BacaraBet: React.FC = () => {
  // 초기 설정값
  const INITIAL_BALANCE = 3000000;
  const INITIAL_VALUE = 1000;
  
  // 기존 상태 관리
  const [initialBalance, setInitialBalance] = useState<number>(INITIAL_BALANCE);
  const [initialValue, setInitialValue] = useState<number>(INITIAL_VALUE);
  const [betArray, setBetArray] = useState<number[]>([INITIAL_VALUE, INITIAL_VALUE, INITIAL_VALUE, INITIAL_VALUE]);
  const [multiplierB, setMultiplierB] = useState<string>('1.95');
  const [multiplierP, setMultiplierP] = useState<string>('1.95');
  const [countBet, setCountBet] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(INITIAL_VALUE * 2);
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [profit, setProfit] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentTarget, setCurrentTarget] = useState<'뱅커' | '플레이어'>('뱅커');

  // 새로운 세트 관리 상태 추가
  const [currentSetBetCount, setCurrentSetBetCount] = useState<number>(0); // 현재 세트의 베팅 횟수
  const [totalSetCount, setTotalSetCount] = useState<number>(0); // 총 세트 카운트
  const [isSetActive, setIsSetActive] = useState<boolean>(false); // 세트 활성 여부

  // 초기 잔고 변경 핸들러
  const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setInitialBalance(value);
    }
  };

  // 베팅 기준 금액 변경 핸들러
  const handleInitialValueChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setInitialValue(value);
      setBetArray([value, value, value, value]);
      setBetAmount(value * 2);
      setBalance(initialBalance);
      setProfit(0);
      setLogs([]);
      setCountBet(0);
      setCurrentTarget('뱅커');
      // 세트 관련 상태도 초기화
      setCurrentSetBetCount(0);
      setTotalSetCount(0);
      setIsSetActive(false);
    }
  };

  // 뱅커 배당률 변경 핸들러
  const handleMultiplierChangeB = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setMultiplierB(e.target.value);
  };

  // 플레이어 배당률 변경 핸들러
  const handleMultiplierChangeP = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setMultiplierP(e.target.value);
  };

  // 베팅 초기화 함수
  const initBet = (): void => {
    setBetArray([initialValue, initialValue, initialValue, initialValue]);
    setBetAmount(initialValue * 2);
    setBalance(initialBalance);
    setProfit(0);
    setLogs([]);
    setCountBet(0);
    setCurrentTarget('뱅커');
    // 세트 관련 상태도 초기화
    setCurrentSetBetCount(0);
    setTotalSetCount(0);
    setIsSetActive(false);
  };

  // 베팅 대상 뒤집기 함수
  const reverseBtn = (): void => {
    setCurrentTarget(currentTarget === '뱅커' ? '플레이어' : '뱅커');
  };
  
  // 로그 작성 함수 (최대 30개까지 유지)
  const writeLog = (newLog: string): void => {
    setLogs((prevLogs) => {
      const newLogs = [...prevLogs, newLog];
      if (newLogs.length > 30) {
        return newLogs.slice(1); // 가장 오래된 로그 제거
      }
      return newLogs;
    });
  };

  // 베팅 실행 함수 (라브셰르 시스템 구현 + 세트 관리)
  const placeBet = (betOn: BetResult): void => {
    const currentTargetValue = currentTarget; // 현재 값을 미리 저장
    const myBet: BetResult = currentTargetValue === '뱅커' ? 'B' : 'P';
    let newProfit = profit - betAmount;
    let newBalance = balance - betAmount;
    const result = myBet === betOn ? 'O' : 'X';
    let newBetArray = [...betArray];

    // 첫 베팅인 경우 세트 시작
    if (!isSetActive) {
      setIsSetActive(true);
      setCurrentSetBetCount(1); // 첫 베팅이므로 1
    } else {
      setCurrentSetBetCount(prev => prev + 1); // 베팅 횟수 증가
    }

    // 베팅 결과에 따른 처리
    if (myBet === betOn) {
      // 승리한 경우
      const multiplier = myBet === 'P' ? 
        parseFloat(multiplierP) : 
        parseFloat(multiplierB);
      
      newProfit += betAmount * multiplier;
      newBalance += betAmount * multiplier;
      
      // 라브셰르 시스템: 승리 시 첫 번째와 마지막 요소 제거
      newBetArray.shift(); // 첫 번째 요소 제거
      newBetArray.pop();   // 마지막 요소 제거
    } else {
      // 패배한 경우: 베팅 금액을 배열 끝에 추가
      newBetArray.push(betAmount);
    }

    // 로그 작성
    const log = `[${countBet}] : ${myBet}(${betAmount}) => ${betOn}(${betAmount})${result}(${newProfit})`;
    
    // 모든 상태 업데이트를 한번에 처리
    setCurrentTarget(currentTargetValue === '뱅커' ? '플레이어' : '뱅커');
    setBetArray(newBetArray);
    
    // 새로운 베팅 금액 계산
    const newBetAmount = newBetArray.length === 0 ? initialValue * 2 : 
                        newBetArray.length === 1 ? newBetArray[0] : 
                        newBetArray[0] + newBetArray[newBetArray.length - 1];
    setBetAmount(newBetAmount);
    
    setProfit(newProfit);
    setBalance(newBalance);
    setCountBet(prev => prev + 1);
    writeLog(log);
    
    // 모든 베팅이 성공하여 배열이 비어있는 경우: 세트 종료 및 새 사이클 시작
    if (newBetArray.length === 0) {
      setBetArray([initialValue, initialValue, initialValue, initialValue]);
      writeLog('----------------------------------------');
      
      // 세트 종료 처리
      setTotalSetCount(prev => prev + 1); // 총 세트 카운트 증가
      setCurrentSetBetCount(0); // 현재 세트 베팅 횟수 초기화
      setIsSetActive(false); // 세트 비활성화
    }
  };

  return (
    <Base>
      <Title>🎲 베팅 게임</Title>
      <Form>
        {/* 초기 설정 섹션 */}
        <InputGroup>
          <Label>초기 잔고:</Label>
          <Input
            type="number"
            value={initialBalance}
            onChange={handleInitialBalanceChange}
            placeholder="초기 잔고"
          />
        </InputGroup>

        <InputGroup>
          <Label>베팅 기준 금액:</Label>
          <Input
            type="number"
            value={initialValue}
            onChange={handleInitialValueChange}
            placeholder="베팅 기준 금액"
          />
        </InputGroup>

        {/* 배당률 설정 섹션 */}
        <InputGroup>
          <Label>뱅커 배당률:</Label>
          <Input
            type="number"
            step="0.01"
            value={multiplierB}
            onChange={handleMultiplierChangeB}
            placeholder="뱅커 배당률"
          />
        </InputGroup>

        <InputGroup>
          <Label>플레이어 배당률:</Label>
          <Input
            type="number"
            step="0.01"
            value={multiplierP}
            onChange={handleMultiplierChangeP}
            placeholder="플레이어 배당률"
          />
        </InputGroup>

        {/* 현재 상태 정보 - 총 세트 카운트 추가 */}
        <InfoBox>
          잔고: <HighlightPink>{balance.toLocaleString()}</HighlightPink>원, 
          {' '}수익금: <HighlightPink>{profit.toLocaleString()}</HighlightPink>원, 
          {' '}총 베팅 횟수: <HighlightYellow>{countBet}</HighlightYellow>회
          <br />
          {' '}완료된 게임 수: <HighlightBlue>{totalSetCount}</HighlightBlue>세트
          <Button onClick={initBet}>초기화</Button>
        </InfoBox>

        {/* 베팅 섹션 */}
        <ResultBox>
          <div>
            <BetTextArea>
            <HighlightBlue>{currentTarget}</HighlightBlue>에 
            <HighlightGreen>{betAmount.toLocaleString()}</HighlightGreen>원을 베팅하세요.
            </BetTextArea>
            <ButtonArea>
            <Button onClick={reverseBtn}>뒤집기</Button>
            </ButtonArea>
          </div>
        <GameResultDiv>
            게임 결과:
            <Button onClick={() => placeBet('B')}>뱅커 승리</Button>
            <Button onClick={() => placeBet('P')}>플레이어 승리</Button>
        </GameResultDiv>
        </ResultBox>

        {/* 새로운 블럭: 현재 세트의 베팅 횟수 표시 */}
        <InfoBox>
          {isSetActive ? (
            <div>
             베팅 횟수: <HighlightGreen>({currentSetBetCount})</HighlightGreen>회
            </div>
          ) : (
            <div>
             베팅 대기: <HighlightYellow>(새 게임 시작 준비)</HighlightYellow>
            </div>
          )}
        </InfoBox>

        {/* 베팅 배열 표시 */}
        <InfoBox>
          배팅 배열:
          <ArrayWrapper>
            {betArray.map((bet, index) => (
              <HighlightYellow key={index}>{bet.toLocaleString()}</HighlightYellow>
            ))}
          </ArrayWrapper>
        </InfoBox>

        {/* 베팅 기록 로그 */}
        <LogBox>
          <h3>베팅 기록</h3>
          <ul>
            {logs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        </LogBox>
      </Form>
      <Outlet />
    </Base>
  );
};

export default BacaraBet;
