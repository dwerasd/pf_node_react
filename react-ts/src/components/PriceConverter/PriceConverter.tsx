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
} from './PriceConverter.styles';

const PriceConverter: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState({ val1: 0, val2: 0, val3: 0 });

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

  // 단일 가격 계산 함수
  const calculateSingle = useCallback((price: number) => {
    const calc = (ratio: number) => {
      const base = price * ratio;
      const unit = getHogaunit(base);
      return Math.round(base / unit) * unit;
    };
    return {
      val1: calc(0.77),      // 77%
      val2: calc(0.693),     // 69.3%
      val3: calc(0.65835)    // 65.835%
    };
  }, [getHogaunit]);

  // 입력값 변경 시 자동 계산
  useEffect(() => {
    const price = parseFloat(inputValue);
    setResults(isNaN(price) ? { val1: 0, val2: 0, val3: 0 } : calculateSingle(price));
  }, [inputValue, calculateSingle]);

  return (
    <Container>
      <Title>💰 가격 전환 계산기</Title>
      <Form>
        <InputGroup>
          <Label>기준가:</Label>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="기준가 입력"
          />
        </InputGroup>

        <Result>
          저항: <Highlight>{results.val1.toLocaleString()}</Highlight>
        </Result>
        <Result>
          지지: <Highlight>{results.val2.toLocaleString()}</Highlight>
        </Result>
        <Result>
          위험: <AlertHighlight>{results.val3.toLocaleString()}</AlertHighlight>
        </Result>
      </Form>
    </Container>
  );
};

export default PriceConverter;
