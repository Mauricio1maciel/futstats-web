import type { Metadata } from 'next';
import { AccountScreen } from '@/components/screens/AccountScreen';

export const metadata: Metadata = { title: 'Minha conta' };

export default function AccountPage() {
  return <AccountScreen />;
}
