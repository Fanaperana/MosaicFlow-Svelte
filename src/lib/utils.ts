import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Open a web/mail link in the system browser; other schemes (javascript:, file:) are refused. */
export async function openExternal(url: string | undefined | null): Promise<void> {
	if (!url) return;
	let parsed: URL;
	try {
		parsed = new URL(url.includes('://') || url.startsWith('mailto:') ? url : `https://${url}`);
	} catch {
		return;
	}
	if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return;
	const { openUrl } = await import('@tauri-apps/plugin-opener');
	await openUrl(parsed.href);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
