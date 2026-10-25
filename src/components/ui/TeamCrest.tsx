'use client';

import { useState } from 'react';
import { teamInitials } from '@/lib/teamInitials';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
};

const hasImage = (url?: string | null) => !!url && url !== 'NOT_FOUND';

// Escudo do time. Sem imagem (times pequenos vêm com o escudo vazio) ou se ela não carregar: um escudo
// genérico cinza-escuro com as iniciais em branco, em vez de espaço vazio ou ícone quebrado
export function TeamCrest({ uri, name, size = 24, className = '' }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const box = { width: size, height: size };

  if (hasImage(uri) && failed !== uri) {
    return (
      <img
        src={uri!}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={box}
        onError={() => setFailed(uri!)}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }

  const initials = teamInitials(name);
  return (
    <span role="img" aria-label={name ? `Escudo do ${name}` : 'Escudo'} style={box} className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0" aria-hidden>
        <path d="M12 1.5 3 4.8v6.4c0 5.4 3.8 10 9 11.3 5.2-1.3 9-5.9 9-11.3V4.8L12 1.5Z" className="fill-line-2 stroke-white/15" strokeWidth="0.8" />
      </svg>
      {initials && (
        <span className="relative -mt-[6%] font-bold leading-none tracking-tight text-white" style={{ fontSize: Math.max(7, Math.round(size * 0.34)) }}>
          {initials}
        </span>
      )}
    </span>
  );
}
