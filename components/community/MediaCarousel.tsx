import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { MediaImage } from '@/components/ui/MediaImage';
import type { CommunityPostMedia } from '@/types';
import { colors } from '@/constants/theme';

type Props = {
  media: CommunityPostMedia[];
  height?: number;
};

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
        {media.map((item) => (
          <View key={item.id} style={{ width: slideWidth }}>
            <MediaImage
              uri={item.public_url ?? item.storage_path}
              rounded={4}
              style={{ width: slideWidth, height }}
            />
          </View>
        ))}
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
});
