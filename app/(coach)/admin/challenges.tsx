import { Redirect } from 'expo-router';

/** Legacy admin path → staff challenges manager (coach + admin). */
export default function AdminChallengesRedirect() {
  return <Redirect href="/(coach)/challenges" />;
}
