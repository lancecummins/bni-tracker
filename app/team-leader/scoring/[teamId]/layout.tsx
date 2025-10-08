import { ReactNode } from 'react';

// Simple layout without authentication for team-specific pages
export default function TeamSpecificLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}