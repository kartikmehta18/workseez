'use client';
import React from 'react';

function subscribe(onChange: () => void) {
	window.addEventListener('scroll', onChange, { passive: true });
	return () => window.removeEventListener('scroll', onChange);
}

/**
 * Scroll position is external state, so it is read with useSyncExternalStore
 * rather than a setState-inside-effect. This also covers the "already scrolled
 * on first load" case that previously needed a second effect.
 */
export function useScroll(threshold: number) {
	return React.useSyncExternalStore(
		subscribe,
		() => window.scrollY > threshold,
		() => false, // server render: treat as top of page
	);
}
