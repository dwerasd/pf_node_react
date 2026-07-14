import React, { useState } from 'react';
import {
  Container,
  Title,
  Form,
  InputGroup,
  Label,
  Input,
  ScrollInput,
  Description,
  Result,
  HighlightedSpan
} from './AveragePriceCalculator.styles';

interface AveragePriceState {
  purchasePrice: number;
  currentShares: number;
  currentPrice: number;
  additionalPurchaseAmount: number;
  plannedPurchaseShares: number;
  commission: number; // 이제 백분율로 처리 (예: 0.23%)
  plannedSalePrice: number;
  scrollValue: number;
}

const AveragePriceCalculator: React.FC = () => {
  const [state, setState] = useState<AveragePriceState>({
    purchasePrice: 10000,
    currentShares: 100,
    currentPrice: 9000,
    additionalPurchaseAmount: 0,
    plannedPurchaseShares: 0,
    commission: 0.23, // 백분율 수수료 (0.23%)
    plannedSalePrice: 10500,
    scrollValue: 0,
  });

  // 입력값 변경 핸들러 - 기존 로직 유지하되 수수료 계산 방식 개선
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = parseFloat(value) || 0;
    setState(prevState => ({
      ...prevState,
      [name]: parsedValue,
    }));

    // 추가 매수 금액과 주식 수 간 상호 계산
    if (name === 'additionalPurchaseAmount') {
      const calculatedShares = value ? parsedValue / state.currentPrice : 0;
      setState(prevState => ({
        ...prevState,
        plannedPurchaseShares: calculatedShares,
      }));
    } else if (name === 'plannedPurchaseShares') {
      const calculatedAmount = value ? parsedValue * state.currentPrice : 0;
      setState(prevState => ({
        ...prevState,
        additionalPurchaseAmount: calculatedAmount,
        scrollValue: parsedValue,
      }));
    } else if (name === 'scrollValue') {
      const calculatedShares = parsedValue;
      setState(prevState => ({
        ...prevState,
        plannedPurchaseShares: calculatedShares,
        additionalPurchaseAmount: calculatedShares * state.currentPrice,
      }));
    }
  };

  // 평단가 및 기본 계산 결과
  const calculateResults = () => {
    const totalShares = state.currentShares + state.plannedPurchaseShares;
    // 매수 시 수수료는 고정값으로 처리 (기존 방식 유지)
    const totalCost = (state.purchasePrice * state.currentShares) + state.additionalPurchaseAmount + state.commission;
    const adjustedAveragePrice = totalShares > 0 ? totalCost / totalShares : 0;
    
    return {
      adjustedAveragePrice,
      totalShares,
      totalCost,
    };
  };

  // 매도 시 실수령액 및 순수익 계산 (수수료를 백분율로 적용)
  const calculateSaleResults = () => {
    const { totalShares, totalCost } = calculateResults();
    
    // 매도 금액 계산
    const grossSaleAmount = state.plannedSalePrice * totalShares;
    
    // 매도 수수료 계산 (백분율 적용)
    const saleCommission = grossSaleAmount * (state.commission / 100);
    
    // 실수령액 (매도금액 - 매도수수료)
    const netSaleAmount = grossSaleAmount - saleCommission;
    
    // 순수익 (실수령액 - 총투자비용)
    const netProfit = netSaleAmount - totalCost;
    
    // 수익률 계산
    const profitRate = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      grossSaleAmount,
      saleCommission,
      netSaleAmount,
      netProfit,
      profitRate,
    };
  };

  const { adjustedAveragePrice, totalShares, totalCost } = calculateResults();
  const { grossSaleAmount, saleCommission, netSaleAmount, netProfit, profitRate } = calculateSaleResults();

  // 수익/손실에 따른 스타일 결정
  const getProfitStyle = (profit: number) => ({
    backgroundColor: profit > 0 ? '#4CAF50' : '#f44336',
    color: '#000',
    fontWeight: '600',
    padding: '2px 6px',
    borderRadius: '3px',
    margin: '0 3px',
  });

  return (
    <Container>
      <Title>📈 평단 계산기</Title>
      <Form>
        <InputGroup>
          <Label>현재 평균단가:</Label>
          <Input 
            type="number" 
            name="purchasePrice" 
            value={state.purchasePrice} 
            onChange={handleChange} 
            placeholder="구매 가격" 
          />
          <Description> - 매수가격</Description>
        </InputGroup>
        
        <InputGroup>
          <Label>보유 주식 수:</Label>
          <Input 
            type="number" 
            name="currentShares" 
            value={state.currentShares} 
            onChange={handleChange} 
            placeholder="보유 주식 수" 
          />
          <Description> - 물린 주식수</Description>
        </InputGroup>
        
        <InputGroup>
          <Label>현재 가격:</Label>
          <Input 
            type="number" 
            name="currentPrice" 
            value={state.currentPrice} 
            onChange={handleChange} 
            placeholder="현재 가격" 
          />
          <Description> - 추매 예정 가격</Description>
        </InputGroup>
        
        <InputGroup>
          <Label>추가 매수 수량:</Label>
          <Input 
            type="number" 
            name="plannedPurchaseShares" 
            value={state.plannedPurchaseShares.toFixed(0)} 
            onChange={handleChange} 
            placeholder="구매 예정 주식 수량" 
          />
          <Description> - 수량 직접 입력 가능</Description>
          <ScrollInput 
            type="range" 
            name="scrollValue" 
            min="0" 
            max="10000" 
            value={state.scrollValue} 
            onChange={handleChange} 
          />
          <Description> - 스크롤로 수량 조절 가능</Description>
        </InputGroup>

        <InputGroup>
          <Label>추매 예정 금액:</Label>
          <Input 
            type="number" 
            name="additionalPurchaseAmount" 
            value={state.additionalPurchaseAmount} 
            onChange={handleChange} 
            placeholder="추가 매수 예정 금액" 
          />
          <Description> - 금액으로 수량 조절 가능</Description>
        </InputGroup>

        <InputGroup>
          <Label>거래 수수료 (%):</Label>
          <Input 
            type="number" 
            name="commission" 
            value={state.commission} 
            onChange={handleChange} 
            step="0.01"
            placeholder="수수료 %" 
          />
          <Description> - 매도 시 적용되는 수수료 비율</Description>
        </InputGroup>

        <InputGroup>
          <HighlightedSpan>{state.scrollValue}</HighlightedSpan>
          <span> 주를 추가 매수 한다면</span>
          <br />
          <span>총 주식수는 </span>
          <HighlightedSpan>{totalShares}</HighlightedSpan>
          <span>주, 평균단가는 </span>
          <HighlightedSpan>{adjustedAveragePrice.toFixed(0)}</HighlightedSpan>
          <span> 원이 됩니다.</span>
          <br />
          <HighlightedSpan>{state.currentPrice}</HighlightedSpan>
          <span> 원에 </span>
          <HighlightedSpan>{state.scrollValue}</HighlightedSpan>
          <span> 주를 추가 매수 하려면 </span>
          <HighlightedSpan>
            {state.additionalPurchaseAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          </HighlightedSpan>
          <span> 원이 필요합니다.</span>
        </InputGroup>
        
        <InputGroup>
          <Label>목표 매도 가격:</Label>
          <Input 
            type="number" 
            name="plannedSalePrice" 
            value={state.plannedSalePrice} 
            onChange={handleChange} 
            placeholder="목표 매도 가격" 
          />
          <Description> - 예상 수익 계산용</Description>
        </InputGroup>

        {/* 기존 결과 표시 */}
        <Result>
          매수 금액: {(state.purchasePrice * state.currentShares).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
        </Result>
        <Result>
          평가 금액: {(state.currentPrice * state.currentShares).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
        </Result>
        
        {/* 새로 추가된 매도 관련 결과 */}
        <Result>
          총 투자 비용: {totalCost.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
        </Result>
        <Result>
          예상 매도 금액: {grossSaleAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
        </Result>
        <Result>
          매도 수수료: {saleCommission.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
        </Result>
        <Result>
          <strong>실수령액: {netSaleAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원</strong>
        </Result>
        <Result>
          <strong>
            예상 순수익: 
            <span style={getProfitStyle(netProfit)}>
              {netProfit.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
            </span>
            (
            <span style={getProfitStyle(netProfit)}>
              {profitRate.toFixed(2)}%
            </span>
            )
          </strong>
        </Result>
      </Form>
    </Container>
  );
};

export default AveragePriceCalculator;
