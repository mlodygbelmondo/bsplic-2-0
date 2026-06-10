import AdminLayout from '@/features/admin/components/AdminLayout';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AdminPage() {
  usePageTitle('Admin');
  return <AdminLayout />;
}
