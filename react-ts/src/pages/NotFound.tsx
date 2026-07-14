import React, { useState, useEffect } from 'react';
import '../css/style.css';

/**
 * 404 페이지 컴포넌트 - 최적화된 버전
 * 5초 카운트다운 후 자동으로 홈페이지로 리다이렉트
 * interval을 한 번만 생성하여 성능 최적화
 */
const NotFound: React.FC = () => {
    const [count, setCount] = useState<number>(5);

    useEffect(() => {
        // interval을 한 번만 생성하고 count가 0이 될 때까지 실행
        const intervalId: NodeJS.Timeout = setInterval(() => {
            setCount(prevCount => {
                const nextCount = prevCount - 1;
                
                // 카운트가 0이 되면 리다이렉트 실행 및 interval 정리
                if (nextCount === 0) {
                    clearInterval(intervalId);
                    // 약간의 지연을 두고 리다이렉트 (사용자가 0을 볼 수 있도록)
                    setTimeout(() => {
                        window.history.pushState({}, "", "/");
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    }, 100);
                }
                
                return nextCount;
            });
        }, 1000);

        // cleanup function: 컴포넌트 언마운트 시에만 interval 정리
        return () => {
            clearInterval(intervalId);
        };
    }, []); // 빈 dependency array로 한 번만 실행

    return (
        <div id="notfound">
            <div className="notfound">
                <div className="notfound-404">
                    <h3>Oops! Page not found</h3>
                    <h1><span>4</span><span>0</span><span>4</span></h1>
                </div>
                <h2>we are sorry, but the page you requested was not found</h2>
                <h2>{count}초 후 페이지를 이동합니다.</h2>
            </div>
        </div>
    );
};

export default NotFound;
