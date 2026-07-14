import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Form,
  InputGroup,
  Label,
  Input,
  Result,
  Highlight,
  AlertHighlight
} from './HighLowAnalyzer.styles';

const HighLowAnalyzer: React.FC = () => {
  const [highPrice, setHighPrice] = useState('');
  const [lowPrice, setLowPrice] = useState('');
  const [stockResults, setStockResults] = useState({ val1: 0, val2: 0, val3: 0 });

  // 호가단위 계산 함수
  const getHogaunit = useCallback((price: number): number => {
    if (price < 2000) return 1;
    else if (price < 5000) return 5;
    else if (price < 20000) return 10;
    else if (price < 50000) return 50;
    else if (price < 200000) return 100;
    else if (price < 500000) return 500;
    return 1000;
  }, []);

  // 고가-저가 기반 계산 함수
  const calculateStockValues = useCallback((high: number, low: number) => {
    const src = (high + low) / 2;  // 중간값
    const range = high - low;      // 변동폭
    const ratio_correction = (low / high) * 0.05;  // 동적 보정값

    // 결과 1: 고가에서 동적 비율만큼 하락한 지점
    const dynamic_ratio1 = 0.254 + ratio_correction;
    const base1 = high - range * dynamic_ratio1;
    const roundToHogaunit1 = (price: number) => {
      const unit = getHogaunit(price);
      return Math.round(price / unit) * unit;
    };
    const val1 = roundToHogaunit1(base1);

    // 결과 2: 고가와 저가의 중간값 (호가단위 반올림)
    const roundToHogaunit2 = (price: number) => {
      const unit = getHogaunit(price);
      return Math.round(price / unit) * unit;
    };
    const val2 = roundToHogaunit2(src);

    // 결과 3: 저가에서 동적 비율만큼 상승한 지점
    const dynamic_ratio3 = 0.254 - ratio_correction;
    const base3 = low + range * dynamic_ratio3;
    const roundToHogaunit3 = (price: number) => {
      const unit = getHogaunit(price);
      return Math.round(price / unit) * unit;
    };
    const val3 = roundToHogaunit3(base3);

    return { val1, val2, val3 };
  }, [getHogaunit]);

  // 고가/저가 입력값 변경 시 자동 계산
  useEffect(() => {
    const high = parseFloat(highPrice);
    const low = parseFloat(lowPrice);
    if (isNaN(high) || isNaN(low)) return;
    setStockResults(calculateStockValues(high, low));
  }, [highPrice, lowPrice, calculateStockValues]);

  return (
    <Container>
      <Title>📊 고가-저가 분석기</Title>
      <Form>
        <InputGroup>
          <Label>고가:</Label>
          <Input
            type="number"
            value={highPrice}
            onChange={(e) => setHighPrice(e.target.value)}
            placeholder="최고가 입력"
          />
        </InputGroup>
        
        <InputGroup>
          <Label>저가:</Label>
          <Input
            type="number"
            value={lowPrice}
            onChange={(e) => setLowPrice(e.target.value)}
            placeholder="최저가 입력"
          />
        </InputGroup>

        <Result>
          고가: <Highlight>{stockResults.val1.toLocaleString()}</Highlight>
        </Result>
        <Result>
          평가: <Highlight>{stockResults.val2.toLocaleString()}</Highlight>
        </Result>
        <Result>
          저가: <AlertHighlight>{stockResults.val3.toLocaleString()}</AlertHighlight>
        </Result>
      </Form>
    </Container>
  );
};

export default HighLowAnalyzer;
