import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

import { MediaImage } from '@/components/ui/MediaImage';
import type { CommunityPostMedia } from '@/types';
import { colors, fonts } from '@/constants/theme';

type Props = {
  media: CommunityPostMedia[];
  height?: number;
};

function CommunityVideoSlide({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <VideoView
        style={{ width, height }}
        player={player}
        contentFit="cover"
        nativeControls={playing}
      />
      {!playing ? (
        <Pressable
          onPress={() => {
            setPlaying(true);
            player.play();
          }}
          style={styles.playOverlay}
          accessibilityRole="button"
          accessibilityLabel="Play video">
          <View style={styles.playBtn}>
            <Ionicons name="play" size={28} color={colors.background} />
          </View>
          <Text style={styles.videoBadge}>VIDEO</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MediaCarousel({ media, height = 280 }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const slideWidth = Math.min(width - 32, 520);

  if (!media.length) return null;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
          setIndex(next);
        }}
        decelerationRate="fast"
        snapToInterval={slideWidth}>
        {media.map((item) => {
          const uri = item.public_url ?? item.storage_path;
          return (
            <View key={item.id} style={{ width: slideWidth }}>
              {item.media_type === 'video' ? (
                <CommunityVideoSlide uri={uri} width={slideWidth} height={height} />
              ) : (
                <MediaImage uri={uri} rounded={4} style={{ width: slideWidth, height }} />
              )}
            </View>
          );
        })}
      </ScrollView>
      {media.length > 1 ? (
        <View style={styles.dots}>
          {media.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: i * slideWidth, animated: true });
                setIndex(i);
              }}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 16,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
