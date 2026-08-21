import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { InstagramAccount } from './types';

// Ulangan Instagram akkaunt bir nechta sahifa/komponentda kerak bo'ladi (header, inbox,
// leads, calls, stats, chat oynasi). Har biri o'zining useQuery'sini yozgani sabab bir xil
// so'rov sahifa almashganda qayta-qayta yuborilib, backend rate limitiga tez urilib qolar edi —
// shu uchun bitta umumiy hook orqali React Query keshi ('instagram-account' key + staleTime)
// haqiqatan ham baham ko'riladi.
export function useInstagramAccount() {
  return useQuery({
    queryKey: ['instagram-account'],
    queryFn: async () => {
      const { data } = await api.get<{ account: InstagramAccount | null }>('/instagram/account');
      return data.account;
    },
    staleTime: 60_000,
  });
}
