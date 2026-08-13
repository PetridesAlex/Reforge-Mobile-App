export type CommunitySurface = 'member' | 'coach';

export type CommunityPaths = {
  surface: CommunitySurface;
  home: string;
  compose: string;
  edit: (postId: string) => string;
  saved: string;
  messages: string;
  post: (id: string) => string;
  profile: (userId: string) => string;
  moderate?: string;
};

export function communityPathsFor(surface: CommunitySurface): CommunityPaths {
  if (surface === 'coach') {
    return {
      surface: 'coach',
      home: '/(coach)/community',
      compose: '/(coach)/community/compose',
      edit: (postId) => `/(coach)/community/compose?edit=${postId}`,
      saved: '/(coach)/community/saved',
      messages: '/(coach)/messages',
      post: (id) => `/(coach)/community/post/${id}`,
      profile: (userId) => `/(coach)/community/profile/${userId}`,
      moderate: '/(coach)/admin/community',
    };
  }
  return {
    surface: 'member',
    home: '/(member)/community',
    compose: '/(member)/community/compose',
    edit: (postId) => `/(member)/community/compose?edit=${postId}`,
    saved: '/(member)/community/saved',
    messages: '/(member)/messages',
    post: (id) => `/(member)/community/post/${id}`,
    profile: (userId) => `/(member)/community/profile/${userId}`,
  };
}
