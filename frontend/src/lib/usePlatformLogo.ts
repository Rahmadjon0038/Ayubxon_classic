import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Platforma logotipi — super-admin galereyadan tanlab qo'ygan rasm. Hamma joyda
// (login sahifalari, sidebarlar) shu orqali o'qiladi; hali qo'yilmagan bo'lsa null
// qaytadi, chaqiruvchi tomon standart SVG logoga tushib qoladi.
export function usePlatformLogo() {
  return useQuery({
    queryKey: ['platform-logo'],
    queryFn: async () => {
      const { data } = await api.get<{ logoUrl: string | null }>('/platform-settings');
      return data.logoUrl;
    },
    staleTime: 5 * 60_000,
  });
}
