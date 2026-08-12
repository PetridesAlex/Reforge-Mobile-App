import * as WebBrowser from 'expo-web-browser';

/** Required so OAuth redirects complete correctly on web and native. */
WebBrowser.maybeCompleteAuthSession();
