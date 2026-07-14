import React from 'react';
import {
  FooterContainer,
  LeftSection,
  RightSection,
  GithubLink
} from './MainFooter.styles';

/**
 * Github 링크 클릭 핸들러
 * 보안을 고려한 외부 링크 열기
 * noopener, noreferrer 옵션으로 보안 취약점 방지
 */
const handleGithubClick = (): void => {
  window.open('https://github.com/dwerasd', '_blank', 'noopener,noreferrer');
};

/**
 * MainFooter 컴포넌트의 Props 타입
 */
interface MainFooterProps {
  className?: string;
}

/**
 * Footer 컴포넌트
 * 하단 영역에 배치되는 푸터 컴포넌트
 * 좌측과 우측 섹션으로 나뉘며, 우측에 Github 링크 포함
 */
const MainFooter: React.FC<MainFooterProps> = ({ className }) => {
  return (
    <FooterContainer className={className} role="contentinfo">
      <LeftSection>
        {/* 좌측 컨텐츠 영역 - 로고나 추가 메뉴 배치 가능 */}
      </LeftSection>

      <RightSection>
        <GithubLink 
          onClick={handleGithubClick}
          aria-label="Github 페이지 새창으로 열기"
        >
          Github
        </GithubLink>
      </RightSection>
    </FooterContainer>
  );
};

export default MainFooter;
