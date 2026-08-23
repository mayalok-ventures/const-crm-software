import TenantDetailClient from '@/components/superadmin/TenantDetailClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <TenantDetailClient />;
}
