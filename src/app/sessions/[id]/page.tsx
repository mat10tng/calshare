'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionRedirect({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  useEffect(() => {
    params.then((p) => router.replace(`/group?id=${p.id}`));
  }, [params, router]);
  return null;
}
