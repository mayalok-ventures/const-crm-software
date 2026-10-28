'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname } from 'next/navigation';

function TopProgressBarInner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const finishTimerRef = useRef(null);

  const startProgress = () => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setVisible(true);
    setProgress(30);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(timerRef.current);
          return 85;
        }
        const step = Math.max(1, (85 - prev) * 0.18);
        return prev + step;
      });
    }, 100);
  };

  const completeProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    finishTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  };

  // Complete progress whenever the pathname updates (navigation finished)
  useEffect(() => {
    completeProgress();
  }, [pathname]);

  // Intercept all internal navigation clicks for instantaneous (0ms) feedback
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      // Ignore external links, anchors, or new tab links
      if (
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        anchor.target === '_blank' ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey
      ) {
        return;
      }

      // Check if clicking currently active pathname
      const currentPath = window.location.pathname;
      if (href === currentPath || href === currentPath + '/') {
        return;
      }

      startProgress();
    };

    const handleCustomStart = () => startProgress();
    const handleCustomDone = () => completeProgress();

    window.addEventListener('click', handleGlobalClick, { capture: true });
    window.addEventListener('crm-nav-start', handleCustomStart);
    window.addEventListener('crm-nav-done', handleCustomDone);

    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
      window.removeEventListener('crm-nav-start', handleCustomStart);
      window.removeEventListener('crm-nav-done', handleCustomDone);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '3px',
        zIndex: 9999999,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 50%, #a855f7 100%)',
          boxShadow: '0 0 10px rgba(99, 102, 241, 0.8), 0 0 5px rgba(168, 85, 247, 0.6)',
          transition: progress === 100 ? 'width 0.12s ease-out' : 'width 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  );
}
