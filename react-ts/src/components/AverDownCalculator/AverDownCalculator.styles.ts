import styled from 'styled-components';

export const Container = styled.div`
  background: rgba(255,255,255,0.09);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 14px;
  padding: 18px 20px 24px;
  backdrop-filter: blur(5px);
  box-shadow: 0 6px 18px rgba(0,0,0,0.22);
  width: 100%;
  max-width: 940px; /* 전체 폭 감소 */
  margin: 0 auto;
  color: #fff;
  transition: max-width .25s ease;

  @media (max-width: 1100px) { max-width: 880px; }
  @media (max-width: 980px) { max-width: 820px; }
  @media (max-width: 860px) { max-width: 760px; }
  @media (max-width: 780px) { max-width: 720px; }
  @media (max-width: 740px) { max-width: 680px; padding: 16px 16px 20px; }
  @media (max-width: 680px) { max-width: 640px; }
  @media (max-width: 640px) { max-width: 600px; }
  @media (max-width: 600px) { max-width: 560px; }
  @media (max-width: 560px) { max-width: 480px; }
  @media (max-width: 520px) { max-width: 440px; }
  @media (max-width: 480px) { max-width: 400px; border-radius: 10px; }
  @media (max-width: 420px) { max-width: 360px; }
  @media (max-width: 380px) { max-width: 340px; }
`;

export const Title = styled.h2`
  font-size: 1.9rem;
  margin: 0 0 10px;
  font-weight: 700;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const Description = styled.p`
  margin: 0 0 24px;
  font-size: .95rem;
  line-height: 1.5;
  color: rgba(255,255,255,0.85);
`;

export const TableWrapper = styled.div`
  overflow-x: auto;
  margin-bottom: 16px;
`;

export const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: .85rem;
  min-width: 620px; /* 기존 760 -> 620 */
  table-layout: fixed; /* 좁은 폭에서도 균등 분배 */

  th, td {
    padding: 6px 8px;
    text-align: right;
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }

  thead th {
    position: sticky;
    top: 0;
    background: rgba(0,0,0,0.35);
    backdrop-filter: blur(4px);
    font-weight: 600;
    font-size: .62rem;
    letter-spacing: .5px;
    text-transform: uppercase;
    color: #cfe0ff;
  }

  tbody tr:hover {
    background: rgba(255,255,255,0.05);
  }

  /* 열 너비 세분화 */
  th:nth-child(1), td:nth-child(1) { width: 40px; }
  th:nth-child(2), td:nth-child(2) { width: 120px; }
  th:nth-child(3), td:nth-child(3) { width: 110px; }
  th:nth-child(4), td:nth-child(4) { width: 150px; }
  th:nth-child(5), td:nth-child(5) { width: 60px; }

  /* 모바일: 테이블 형태 유지 + 더욱 컴팩트 */
  @media (max-width: 620px) {
    font-size: .7rem;
    min-width: 100%;
    th, td { padding: 4px 6px; }
    th:nth-child(1), td:nth-child(1) { width: 26px; }
    th:nth-child(2), td:nth-child(2) { width: 78px; }
    th:nth-child(3), td:nth-child(3) { width: 78px; }
    th:nth-child(4), td:nth-child(4) { width: 86px; }
    th:nth-child(5), td:nth-child(5) { width: 40px; }
    thead th { font-size: .55rem; }
  }
`;

export const IndexCell = styled.td`
  font-weight: 600;
  color: #9ec5ff;
  text-align: center !important;
  width: 38px;
  @media (max-width: 620px) { width: 26px; font-size: .65rem; }
`;

export const Input = styled.input`
  width: 60%; /* 기존 대비 약 절반 크기 */
  min-width: 110px;
  max-width: 180px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.28);
  background: rgba(255,255,255,0.16);
  color: #fff;
  font-size: .85rem;
  outline: none;
  text-align: right;
  transition: all .18s ease;
  display: block;
  margin: 0 auto; /* 셀 가운데 정렬 */
  box-shadow: 0 0 0 2px rgba(255,255,255,0.02) inset;
  @media (max-width: 620px) {
    width: 70px;
    min-width: 0;
    max-width: 80px;
    font-size: .65rem;
    padding: 4px 4px;
    margin: 0;
    background: rgba(255,255,255,0.28); /* 모바일 더 밝게 */
    border-color: rgba(255,255,255,0.4);
    &::placeholder { color: rgba(255,255,255,0.55); }
  }

  &:focus {
    border-color: #7fb4ff;
    background: rgba(255,255,255,0.22);
    box-shadow: 0 0 0 2px rgba(127,180,255,0.25), 0 2px 4px rgba(0,0,0,0.4) inset;
  }

  &::placeholder { color: rgba(255,255,255,0.35); }
`;

export const RowValue = styled.div`
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #ffe8a3;
`;

export const FooterSummary = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(180px,1fr));
  gap: 12px;
  margin: 20px 0 4px;
`;

export const StatCard = styled.div<{ $accent?: string }>`
  background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.18);
  padding: 10px 12px 12px;
  border-radius: 10px;
  position: relative;
  overflow: hidden;
  min-height: 74px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${({ $accent }) => $accent || 'transparent'};
    opacity: .18;
    z-index: -1;
  }

  h4 {
    margin: 0 0 2px;
    font-size: .67rem;
    font-weight: 600;
    letter-spacing: .4px;
    text-transform: uppercase;
    color: #cddfff;
  }

  strong {
    font-size: .95rem;
    font-weight: 700;
    letter-spacing: -.3px;
    color: #fff;
    line-height: 1.25;
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
`;

export const Button = styled.button<{ $variant?: 'primary'|'danger'|'ghost' }>`
  border: none;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 7px;
  font-weight: 600;
  font-size: .78rem;
  letter-spacing: .3px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: ${({ $variant }) => $variant==='danger' ? 'linear-gradient(135deg,#ff5858,#f09819)' : $variant==='ghost' ? 'rgba(255,255,255,0.10)' : 'linear-gradient(135deg,#4facfe,#00f2fe)'};
  color: ${({ $variant }) => $variant==='ghost' ? '#e2eeff' : '#102a43'};
  border: ${({ $variant }) => $variant==='ghost' ? '1px solid rgba(255,255,255,0.22)' : 'none'};
  transition: all .18s ease;

  &:hover { filter: brightness(1.08); transform: translateY(-2px); }
  &:active { filter: brightness(.95); transform: translateY(0); }
  &:disabled { opacity: .45; cursor: not-allowed; transform:none; }
`;

export const InlineGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(150px,1fr));
  gap: 12px 14px;
  margin-top: 6px;
  align-items: start;
`;

export const InlineField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: .63rem;
  text-transform: uppercase;
  letter-spacing: .45px;
  min-width: 140px;
  flex: 1;
  color: #d8e6ff;
`;

export const NumberStrong = styled.span<{ $positive?: boolean }>`
  font-weight: 700;
  font-size: .9rem;
  color: ${({ $positive }) => $positive === undefined ? '#fff' : ($positive ? '#4df5b5' : '#ff8e8e')};
  font-variant-numeric: tabular-nums;
`;

export const Divider = styled.hr`
  border: none;
  border-top: 1px dashed rgba(255,255,255,0.25);
  margin: 20px 0 14px;
`;

export const HelpText = styled.p`
  font-size: .7rem;
  letter-spacing: .2px;
  color: rgba(255,255,255,0.55);
  margin: 6px 0 0;
`;

export const ProfitBadge = styled.span<{ $profit?: number }>`
  display: inline-block;
  padding: 3px 7px 4px;
  border-radius: 16px;
  font-size: .6rem;
  font-weight: 600;
  letter-spacing: .45px;
  background: ${({ $profit }) => $profit !== undefined ? ($profit>0 ? 'linear-gradient(135deg,#32d27a,#05a96e)' : $profit<0 ? 'linear-gradient(135deg,#ff5858,#d84b6d)' : 'linear-gradient(135deg,#8899aa,#6f8091)') : 'rgba(255,255,255,0.15)'};
  color: #fff;
`;

export const Mini = styled.span`
  font-size: .55rem;
  opacity: .6;
  margin-left: 4px;
`;
