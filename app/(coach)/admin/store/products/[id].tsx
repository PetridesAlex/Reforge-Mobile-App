import { useLocalSearchParams } from 'expo-router';

import { ProductEditorScreen } from '@/components/store/ProductEditorScreen';

export default function AdminEditProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductEditorScreen mode="edit" productId={id} />;
}
