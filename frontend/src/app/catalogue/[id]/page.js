import CollegeDetailClient from '@/components/CollegeDetailClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function CatalogueDetailPage() {
  return <CollegeDetailClient />;
}
