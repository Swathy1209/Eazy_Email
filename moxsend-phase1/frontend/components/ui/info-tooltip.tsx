'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title?: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function InfoTooltip({
  title,
  description,
  side = 'top',
}: InfoTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={180}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={title || 'Information'}
            className="
              ml-2
              inline-flex
              h-5
              w-5
              shrink-0
              items-center
              justify-center
              rounded-full

              border border-slate-300/70
              bg-white/70
              text-slate-500

              backdrop-blur-md

              transition-all
              duration-200

              hover:scale-105
              hover:border-gray-500
              hover:bg-gray-700
              hover:text-white
              hover:shadow-[0_0_14px_rgba(80,80,80,0.45)]

              focus:outline-none
              focus:ring-2
              focus:ring-gray-500/40

              dark:border-[#3A3A3A]
              dark:bg-[#1F1F1F]/80
              dark:text-[#B8B8B8]

              dark:hover:border-[#5A5A5A]
              dark:hover:bg-[#3A3A3A]
              dark:hover:text-white
              dark:hover:shadow-[0_0_16px_rgba(70,70,70,0.45)]

              dark:focus:ring-[#5A5A5A]/40
            "
          >
            <Info className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </TooltipPrimitive.Trigger>

        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={10}
            collisionPadding={16}
            className="
              z-[9999]

              !w-[80px]
              !min-w-[80px]
              !max-w-[80px]

              overflow-hidden
              break-words

              rounded-xl
              border border-[#3A3A3A]

              bg-[#2B2B2B]/95

              px-2
              py-2

              text-left

              shadow-[0_10px_30px_rgba(0,0,0,0.45)]

              backdrop-blur-xl

              data-[state=closed]:animate-out
              data-[state=closed]:fade-out-0
              data-[state=closed]:zoom-out-95

              data-[state=open]:animate-in
              data-[state=open]:fade-in-0
              data-[state=open]:zoom-in-95
            "
          >
            {title ? (
              <p
                className="
                  mb-1
                  text-[11px]
                  font-semibold
                  text-white
                  break-words
                  whitespace-normal
                "
              >
                {title}
              </p>
            ) : null}

            <p
              className="
                text-[10px]
                leading-4
                text-gray-300
                break-words
                whitespace-normal
              "
            >
              {description}
            </p>

            <TooltipPrimitive.Arrow className="fill-[#2B2B2B]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}