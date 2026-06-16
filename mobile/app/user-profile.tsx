import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (userId) {
      router.replace({ pathname: '/home', params: { tab: 'dashboard', openProfile: userId } });
    } else {
      router.back();
    }
  }, [userId]);

  return null;
}
