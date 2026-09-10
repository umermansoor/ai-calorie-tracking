import { router } from 'expo-router';

/** Back if there's history (there may be none after a web reload), otherwise home. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
