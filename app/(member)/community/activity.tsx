import { Redirect } from 'expo-router';

/** Legacy route — gym activity lives on Community → GYM. */
export default function ActivityFeedRedirect() {
  return <Redirect href="/(member)/community" />;
}
