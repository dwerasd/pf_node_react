import React, { useEffect } from 'react';
import styled from 'styled-components';

const GRID_LAYOUT_COOKIE_KEY = 'tmengine:gridLayouts';
const GRID_RESET_FLAG_KEY = 'tmengine:grid-reset';
const RESET_REDIRECT_DELAY = 450;

const ResetGridLayout: React.FC = () => {
  useEffect(() => {
    try {
      document.cookie = `${GRID_LAYOUT_COOKIE_KEY}=; max-age=0; path=/; SameSite=Lax`;
    } catch (error) {
      console.warn('그리드 레이아웃 쿠키를 제거하지 못했습니다.', error);
    }

    try {
      window.localStorage?.removeItem(GRID_LAYOUT_COOKIE_KEY);
    } catch (error) {
      console.warn('그리드 레이아웃 로컬 저장소 값을 제거하지 못했습니다.', error);
    }

    try {
      window.sessionStorage?.setItem(GRID_RESET_FLAG_KEY, `${Date.now()}`);
    } catch (error) {
      console.warn('그리드 리셋 플래그를 설정하지 못했습니다.', error);
    }

    const timer = window.setTimeout(() => {
      window.location.replace('/stock-analysis?layoutReset=1');
    }, RESET_REDIRECT_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <Container>
      <MessageTitle>그리드 레이아웃을 초기화하는 중입니다…</MessageTitle>
      <MessageDescription>잠시 후 종목분석 화면으로 돌아갑니다.</MessageDescription>
    </Container>
  );
};

export default ResetGridLayout;

const Container = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 40vh;
  text-align: center;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const MessageTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.sizes.xl};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

const MessageDescription = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.md};
  color: ${({ theme }) => theme.colors.text.secondary};
`;
