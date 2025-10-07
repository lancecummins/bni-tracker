import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallbackSeed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
}

export function Avatar({
  src,
  alt = '',
  fallbackSeed = 'default',
  size = 'md',
  className = ''
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    custom: '' // No default size for custom
  };

  const fallbackUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${fallbackSeed}`;
  const displaySrc = imgError || !src ? fallbackUrl : src;

  return (
    <div className={`${size === 'custom' ? '' : sizeClasses[size]} rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ${className}`}>
      <img
        src={displaySrc}
        alt={alt}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover"
        style={{ objectPosition: 'center' }}
      />
    </div>
  );
}