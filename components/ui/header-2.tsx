'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Briefcase } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';

/** Just enough of the signed-in user for the marketing header to render. */
type HeaderUser = { name: string; email: string; picture?: string | null };

function Avatar({ user, className }: { user: HeaderUser; className?: string }) {
	if (user.picture) {
		return (
			<Image
				src={user.picture}
				alt=""
				width={40}
				height={40}
				className={cn('border-border rounded-full border object-cover', className)}
			/>
		);
	}
	return (
		<span
			className={cn(
				'bg-primary text-primary-foreground flex items-center justify-center rounded-full text-xs font-medium',
				className,
			)}
		>
			{user.name.charAt(0).toUpperCase()}
		</span>
	);
}

export function Header({ user }: { user?: HeaderUser | null }) {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);

	const links = [
		// {
		// 	label: 'Features',
		// 	href: '#',
		// },
		// {
		// 	label: 'Pricing',
		// 	href: '#',
		// },
		{
			label: 'About',
			href: '#',
		},
	];

	React.useEffect(() => {
		if (open) {
			// Disable scroll
			document.body.style.overflow = 'hidden';
		} else {
			// Re-enable scroll
			document.body.style.overflow = '';
		}

		// Cleanup when component unmounts (important for Next.js)
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	return (
		<header
			className={cn(
				'sticky top-0 z-50 mx-auto w-full max-w-5xl border-b border-transparent md:rounded-md md:border md:transition-all md:ease-out',
				{
					'bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg md:top-4 md:max-w-4xl md:shadow':
						scrolled && !open,
					'bg-background/90': open,
				},
			)}
		>
			<nav
				className={cn(
					'flex h-14 w-full items-center justify-between px-4 md:h-12 md:transition-all md:ease-out',
					{
						'md:px-2': scrolled,
					},
				)}
			>
				<Link href="/" className="flex items-center gap-2 font-semibold">
					{/* <Briefcase className="size-5" /> */}
				<Image
				src='/logo.jpeg'
				alt=""
				width={40}
				height={40}
				className={cn('border-border rounded-sm border object-cover size-8')}
			/>
					<span>Workseez</span>
				</Link>
				<div className="hidden items-center gap-2 md:flex">
					{links.map((link, i) => (
						<a key={i} className={buttonVariants({ variant: 'ghost' })} href={link.href}>
							{link.label}
						</a>
					))}
					{user ? (
						<>
							<Link href="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
								Dashboard
							</Link>
							<form action="/api/auth/signout" method="post">
								<Button type="submit" variant="outline">
									Sign Out
								</Button>
							</form>
							<Link href="/dashboard" aria-label={user.name}>
								<Avatar user={user} className="size-8" />
							</Link>
						</>
					) : (
						<>
							<Link href="/login" className={buttonVariants({ variant: 'outline' })}>
								Sign In
							</Link>
							<Link href="/login" className={buttonVariants()}>
								Get Started
							</Link>
						</>
					)}
				</div>
				<Button size="icon" variant="outline" onClick={() => setOpen(!open)} className="md:hidden">
					<MenuToggleIcon open={open} className="size-5" duration={300} />
				</Button>
			</nav>

			<div
				className={cn(
					// Opaque, not /90: this is a full-screen panel, and a translucent
					// background let the page content read through the open menu.
					'bg-background fixed top-14 right-0 bottom-0 left-0 z-50 flex flex-col overflow-y-auto border-y md:hidden',
					open ? 'block' : 'hidden',
				)}
			>
				<div
					data-slot={open ? 'open' : 'closed'}
					className={cn(
						'data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 data-[slot=closed]:animate-out data-[slot=closed]:zoom-out-95 ease-out',
						'flex h-full w-full flex-col justify-between gap-y-2 p-4',
					)}
				>
					<div className="grid gap-y-2">
						{links.map((link) => (
							<a
								key={link.label}
								className={buttonVariants({
									variant: 'ghost',
									className: 'justify-start',
								})}
								href={link.href}
							>
								{link.label}
							</a>
						))}
					</div>
					<div className="flex flex-col gap-2">
						{user ? (
							<>
								<div className="flex items-center gap-3 px-1 pb-2">
									<Avatar user={user} className="size-9" />
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{user.name}</p>
										<p className="text-muted-foreground truncate text-xs">{user.email}</p>
									</div>
								</div>
								<Link
									href="/dashboard"
									onClick={() => setOpen(false)}
									className={buttonVariants({ className: 'w-full' })}
								>
									Dashboard
								</Link>
								<form action="/api/auth/signout" method="post">
									<Button type="submit" variant="outline" className="w-full">
										Sign Out
									</Button>
								</form>
							</>
						) : (
							<>
								<Link
									href="/login"
									onClick={() => setOpen(false)}
									className={buttonVariants({ variant: 'outline', className: 'w-full' })}
								>
									Sign In
								</Link>
								<Link
									href="/login"
									onClick={() => setOpen(false)}
									className={buttonVariants({ className: 'w-full' })}
								>
									Get Started
								</Link>
							</>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
