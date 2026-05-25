import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useScrollHide } from './useScrollHide';

type PrototypeFrameProps = {
  top: ReactNode;
  bottom: ReactNode;
  background?: string;
  children: ReactNode;
  topClassName?: string;
  bottomClassName?: string;
};

export const PrototypeFrame = ({
  top,
  bottom,
  background = 'bg-neutral-950',
  children,
  topClassName,
  bottomClassName,
}: PrototypeFrameProps) => {
  const { hidden, elementRef } = useScrollHide({ threshold: 6, topPin: 24 });

  return (
    <div className={cn('relative h-full w-full overflow-hidden', background)}>
      <header
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-30 transition-transform duration-300 ease-out',
          hidden ? '-translate-y-full' : 'translate-y-0',
          topClassName,
        )}
      >
        <div className="pointer-events-auto">{top}</div>
      </header>

      <main
        ref={elementRef as React.RefObject<HTMLElement>}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-hide"
      >
        {children}
      </main>

      <nav
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 z-30 transition-transform duration-300 ease-out',
          hidden ? 'translate-y-full' : 'translate-y-0',
          bottomClassName,
        )}
      >
        <div className="pointer-events-auto">{bottom}</div>
      </nav>
    </div>
  );
};
