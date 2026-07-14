import React, { useState, useMemo } from 'react';
import {
  Container, Title, Description, TableWrapper, DataTable, IndexCell, Input, RowValue,
  FooterSummary, StatCard, Actions, Button, InlineGroup, InlineField, NumberStrong,
  Divider, HelpText, ProfitBadge, Mini
} from './AverDownCalculator.styles';

interface AverRow { price: number | ''; qty: number | ''; }

const MAX_ROWS = 8;

const formatNumber = (n: number, opts: Intl.NumberFormatOptions = {}) => {
  if (!isFinite(n)) return '-';
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4, ...opts });
};

const parse = (v: string): number => {
  if (!v) return 0; return parseFloat(v.replace(/,/g,'')||'0');
};

const AverDownCalculator: React.FC = () => {
  const [rows, setRows] = useState<AverRow[]>([
    { price: 10000, qty: 100 },
    { price: 9000, qty: 100 },
  ]);
  const [commissionPercent, setCommissionPercent] = useState<number>(0.23); // 매도 수수료 %
  const [plannedSalePrice, setPlannedSalePrice] = useState<number>(10500);

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    setRows(r => [...r, { price: '', qty: '' }]);
  };
  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(r => r.filter((_, i) => i !== idx));
  };
  const reset = () => {
    setRows([{ price: 10000, qty: 100 }, { price: 9000, qty: 100 }]);
    setCommissionPercent(0.23);
    setPlannedSalePrice(10500);
  };

  const updateCell = (idx: number, field: keyof AverRow, value: string) => {
    const num = value === '' ? '' : parse(value);
    setRows(r => r.map((row,i)=> i===idx ? { ...row, [field]: num } : row));
  };

  const calc = useMemo(()=> {
    const sanitized = rows.map(r => ({ price: typeof r.price==='number'? r.price:0, qty: typeof r.qty==='number'? r.qty:0 }));
    const costPerRow = sanitized.map(r => r.price * r.qty);
    const totalQty = sanitized.reduce((s,r)=> s + r.qty, 0);
    const totalCost = costPerRow.reduce((s,c)=> s + c, 0);
    const avgPrice = totalQty>0 ? totalCost / totalQty : 0;
    const saleGross = plannedSalePrice * totalQty;
    const saleCommission = saleGross * (commissionPercent/100);
    const saleNet = saleGross - saleCommission;
    const profit = saleNet - totalCost;
    const profitRate = totalCost>0 ? profit / totalCost * 100 : 0;
    return { costPerRow, totalQty, totalCost, avgPrice, saleGross, saleCommission, saleNet, profit, profitRate };
  }, [rows, commissionPercent, plannedSalePrice]);

  return (
    <Container>
      <Title>🛒 주식 물타기 계산기</Title>
      <Description>
        여러 차례에 걸친 분할(물타기) 매수 내역을 입력하면 최종 평균단가와 총 매수 금액, 수량을 계산합니다. 목표 매도 가격을 입력하면 수수료와 예상 손익까지 확인할 수 있습니다.
      </Description>

      <TableWrapper>
        <DataTable>
          <thead>
            <tr>
              <th style={{textAlign:'center'}}>#</th>
              <th>매수가 (단가)</th>
              <th>수량</th>
              <th>매수 금액</th>
              <th style={{textAlign:'center'}}>삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const price = row.price === '' ? '' : row.price;
              const qty = row.qty === '' ? '' : row.qty;
              const rowCost = calc.costPerRow[idx] || 0;
              return (
                <tr key={idx}>
                  <IndexCell>{idx+1}</IndexCell>
                  <td data-label="단가">
                    <Input
                      type="number"
                      value={price}
                      placeholder="단가"
                      onChange={e=> updateCell(idx,'price', e.target.value)}
                    />
                  </td>
                  <td data-label="수량">
                    <Input
                      type="number"
                      value={qty}
                      placeholder="수량"
                      onChange={e=> updateCell(idx,'qty', e.target.value)}
                    />
                  </td>
                  <td data-label="매수금액"><RowValue>{formatNumber(rowCost)}</RowValue></td>
                  <td data-label="삭제" style={{textAlign:'center'}}>
                    <Button $variant="ghost" disabled={rows.length<=1} onClick={()=> removeRow(idx)}>✕</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </TableWrapper>

      <Actions>
        <Button onClick={addRow} disabled={rows.length>=MAX_ROWS}>+ 라인 추가 ({rows.length}/{MAX_ROWS})</Button>
        <Button $variant="danger" onClick={reset}>초기화</Button>
      </Actions>

      <Divider />

      <InlineGroup>
        <InlineField>
          <span>목표 매도 가격</span>
          <Input type="number" value={plannedSalePrice} onChange={e=> setPlannedSalePrice(parse(e.target.value))} />
        </InlineField>
        <InlineField>
          <span>매도 수수료 (%)</span>
            <Input type="number" step="0.01" value={commissionPercent} onChange={e=> setCommissionPercent(parse(e.target.value))} />
        </InlineField>
        <InlineField>
          <span>총 수량</span>
          <NumberStrong>{formatNumber(calc.totalQty, {maximumFractionDigits: 4})}</NumberStrong>
        </InlineField>
        <InlineField>
          <span>평균 단가</span>
          <NumberStrong>{formatNumber(calc.avgPrice,{maximumFractionDigits: 2})}</NumberStrong>
        </InlineField>
      </InlineGroup>

      <HelpText>수수료는 매도 금액에만 적용(단순화). 각 증권사 정책에 따라 실제 체결 수수료 / 세금은 다를 수 있습니다.</HelpText>

      <FooterSummary>
        <StatCard $accent="linear-gradient(135deg,#4facfe33,#00f2fe11)">
          <h4>총 매수 금액</h4>
          <strong>{formatNumber(calc.totalCost,{maximumFractionDigits:0})} <Mini>원</Mini></strong>
        </StatCard>
        <StatCard $accent="linear-gradient(135deg,#ffd36e55,#ff8a0055)">
          <h4>목표 매도 금액 (총)</h4>
          <strong>{formatNumber(calc.saleGross,{maximumFractionDigits:0})} <Mini>원</Mini></strong>
        </StatCard>
        <StatCard $accent="linear-gradient(135deg,#ff758c44,#ff7eb344)">
          <h4>매도 수수료</h4>
          <strong>{formatNumber(calc.saleCommission,{maximumFractionDigits:0})} <Mini>원</Mini></strong>
        </StatCard>
        <StatCard $accent="linear-gradient(135deg,#56ab2f44,#a8e06333)">
          <h4>실수령액</h4>
          <strong>{formatNumber(calc.saleNet,{maximumFractionDigits:0})} <Mini>원</Mini></strong>
        </StatCard>
        <StatCard $accent={calc.profit>0? 'linear-gradient(135deg,#42e69555,#3bb2b855)':calc.profit<0?'linear-gradient(135deg,#ff585855,#f0981955)':'linear-gradient(135deg,#8e9eab55,#eef2f355)'}>
          <h4>예상 손익 / 수익률</h4>
          <strong>
            {formatNumber(calc.profit,{maximumFractionDigits:0})} <Mini>원</Mini>
            <br />
            <ProfitBadge $profit={calc.profit}>{calc.profitRate.toFixed(2)}%</ProfitBadge>
          </strong>
        </StatCard>
      </FooterSummary>
    </Container>
  );
};

export default AverDownCalculator;
