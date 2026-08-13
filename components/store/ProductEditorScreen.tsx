import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatStoreMoney, slugifyStoreName } from '@/lib/store/money';
import * as store from '@/services/store';
import type {
  StoreCategory,
  StoreCollection,
  StoreProduct,
  StoreProductStatus,
  StoreSizeGuide,
} from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

const STATUSES: StoreProductStatus[] = ['draft', 'active', 'archived'];
const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const DEFAULT_COLORS = ['Black', 'White'];
const QUICK_COLORS = ['Black', 'White', 'Grey', 'Olive', 'Navy'];
const QUICK_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

type Props = { mode: 'new' | 'edit'; productId?: string };

type FlagKey = 'featured' | 'isNew' | 'isLimited' | 'isBestseller' | 'isBestOfMonth';

const FLAGS: Array<{ key: FlagKey; label: string; hint: string }> = [
  { key: 'featured', label: 'Featured', hint: 'Home + catalog spotlight' },
  { key: 'isNew', label: 'New', hint: 'NEW badge on cards' },
  { key: 'isLimited', label: 'Limited', hint: 'Drop / scarce stock' },
  { key: 'isBestseller', label: 'Best seller', hint: 'Strong seller badge' },
  { key: 'isBestOfMonth', label: 'Best of month', hint: 'Monthly highlight' },
];

function Section({
  kicker,
  title,
  hint,
  children,
}: {
  kicker: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>{kicker}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={styles.sectionRule} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ChoiceChips({
  options,
  value,
  onChange,
  allowClear,
}: {
  options: Array<{ id: string; label: string }>;
  value: string | null;
  onChange: (id: string | null) => void;
  allowClear?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(active && allowClear ? null : opt.id)}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function parseList(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggleInCsv(current: string, item: string) {
  const list = parseList(current);
  const exists = list.some((x) => x.toLowerCase() === item.toLowerCase());
  const next = exists
    ? list.filter((x) => x.toLowerCase() !== item.toLowerCase())
    : [...list, item];
  return next.join(', ');
}

export function ProductEditorScreen({ mode, productId }: Props) {
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [sizeGuides, setSizeGuides] = useState<StoreSizeGuide[]>([]);
  const [product, setProduct] = useState<StoreProduct | null>(null);

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceEuros, setPriceEuros] = useState('39');
  const [compareEuros, setCompareEuros] = useState('');
  const [status, setStatus] = useState<StoreProductStatus>('draft');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [sizeGuideId, setSizeGuideId] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [isLimited, setIsLimited] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isBestOfMonth, setIsBestOfMonth] = useState(false);
  const [details, setDetails] = useState('');
  const [materials, setMaterials] = useState('');
  const [care, setCare] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('RFG');
  const [colorsInput, setColorsInput] = useState(DEFAULT_COLORS.join(', '));
  const [sizesInput, setSizesInput] = useState(DEFAULT_SIZES.join(', '));
  const [showSpecs, setShowSpecs] = useState(mode === 'edit');

  const flagValues: Record<FlagKey, boolean> = {
    featured,
    isNew,
    isLimited,
    isBestseller,
    isBestOfMonth,
  };

  const setFlag = (key: FlagKey, value: boolean) => {
    switch (key) {
      case 'featured':
        setFeatured(value);
        break;
      case 'isNew':
        setIsNew(value);
        break;
      case 'isLimited':
        setIsLimited(value);
        break;
      case 'isBestseller':
        setIsBestseller(value);
        break;
      case 'isBestOfMonth':
        setIsBestOfMonth(value);
        break;
    }
  };

  const hydrate = useCallback(async () => {
    try {
      setError(null);
      const [cats, cols, guides] = await Promise.all([
        store.listCategories(),
        store.listCollections(),
        store.listSizeGuides(),
      ]);
      setCategories(cats);
      setCollections(cols);
      setSizeGuides(guides);

      if (mode === 'edit' && productId) {
        const p = await store.getProduct(productId);
        if (!p) throw new Error('Product not found');
        setProduct(p);
        setName(p.name);
        setSubtitle(p.subtitle ?? '');
        setDescription(p.description ?? '');
        setPriceEuros((p.price_cents / 100).toFixed(2));
        setCompareEuros(
          p.compare_at_cents != null ? (p.compare_at_cents / 100).toFixed(2) : '',
        );
        setStatus(p.status);
        setCategoryId(p.category_id);
        setCollectionId(p.collection_id);
        setSizeGuideId(p.size_guide_id);
        setFeatured(p.featured);
        setIsNew(p.is_new);
        setIsLimited(p.is_limited);
        setIsBestseller(Boolean(p.is_bestseller));
        setIsBestOfMonth(Boolean(p.is_best_of_month));
        setDetails(p.details ?? '');
        setMaterials(p.materials ?? '');
        setCare(p.care_instructions ?? '');
        setSkuPrefix(slugifyStoreName(p.name).slice(0, 8).toUpperCase() || 'RFG');

        const existingColors = Array.from(
          new Set((p.variants ?? []).map((v) => v.color_label).filter(Boolean) as string[]),
        );
        const existingSizes = Array.from(
          new Set((p.variants ?? []).map((v) => v.size_label).filter(Boolean) as string[]),
        );
        if (existingColors.length) setColorsInput(existingColors.join(', '));
        if (existingSizes.length) setSizesInput(existingSizes.join(', '));
      } else if (mode === 'new' && cats[0]) {
        setCategoryId((current) => current ?? cats[0]!.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [mode, productId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshProduct = async (id: string) => {
    const p = await store.getProduct(id);
    setProduct(p);
  };

  const parseCents = (value: string) => {
    const n = Number(value.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) return null;
    return Math.round(n * 100);
  };

  const previewPrice = useMemo(() => {
    const cents = parseCents(priceEuros);
    return cents == null ? '—' : formatStoreMoney(cents);
  }, [priceEuros]);

  const variantCount = product?.variants?.length ?? 0;
  const imageCount = product?.images?.length ?? 0;
  const selectedColors = parseList(colorsInput);
  const selectedSizes = parseList(sizesInput);

  const save = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Product name is required');
      return;
    }
    const price_cents = parseCents(priceEuros);
    if (price_cents == null) {
      setFormError('Enter a valid price');
      return;
    }
    const compare_at_cents = compareEuros.trim() ? parseCents(compareEuros) : null;
    if (compareEuros.trim() && compare_at_cents == null) {
      setFormError('Enter a valid compare-at price');
      return;
    }

    setSaving(true);
    try {
      const saved = await store.upsertProduct({
        id: product?.id,
        name: name.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        status,
        price_cents,
        compare_at_cents,
        category_id: categoryId,
        collection_id: collectionId,
        size_guide_id: sizeGuideId,
        featured,
        is_new: isNew,
        is_limited: isLimited,
        is_bestseller: isBestseller,
        is_best_of_month: isBestOfMonth,
        details: details.trim() || null,
        materials: materials.trim() || null,
        care_instructions: care.trim() || null,
      });
      setProduct(saved);
      setToast('Saved');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (mode === 'new') {
        router.replace(`/(coach)/admin/store/products/${saved.id}`);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    if (!product?.id) {
      setFormError('Save the product before generating variants');
      return;
    }
    if (!selectedColors.length || !selectedSizes.length) {
      setFormError('Pick at least one color and size');
      return;
    }
    setSaving(true);
    try {
      await store.generateVariants({
        product_id: product.id,
        skuPrefix: skuPrefix.trim() || 'RFG',
        colors: selectedColors,
        sizes: selectedSizes,
        stock_qty: 0,
      });
      await refreshProduct(product.id);
      setToast('Variants generated');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not generate variants');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    if (!product?.id) {
      setFormError('Save the product before uploading images');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to upload product images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setSaving(true);
    try {
      await store.uploadProductImage({
        productId: product.id,
        localUri: result.assets[0].uri,
        makePrimary: (product.images?.length ?? 0) === 0,
      });
      await refreshProduct(product.id);
      setToast('Image uploaded');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!product?.id) return;
    Alert.alert('Archive product?', 'It will be hidden from the member store.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await store.archiveProduct(product.id);
          setStatus('archived');
          setToast('Archived');
          await refreshProduct(product.id);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={40} width="60%" style={{ marginTop: spacing.md }} />
        <Skeleton height={200} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error} onRetry={hydrate} />
      </Screen>
    );
  }

  const isCreateFlow = !product;

  return (
    <Screen>
      <BackButton />

      <LinearGradient
        colors={['rgba(200,255,0,0.12)', 'rgba(14,14,14,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Text style={styles.kicker}>
          {isCreateFlow ? 'REFORGE · CREATE' : 'REFORGE · PRODUCT EDITOR'}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {name.trim() || (isCreateFlow ? 'NEW PIECE' : 'EDIT PRODUCT')}
        </Text>
        {isCreateFlow ? (
          <Text style={styles.heroLead}>
            Set the core details, save, then add images and size/color SKUs.
          </Text>
        ) : null}
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaLabel}>STATUS</Text>
            <Text style={styles.heroMetaValue}>{status.toUpperCase()}</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaLabel}>PRICE</Text>
            <Text style={styles.heroMetaAccent}>{previewPrice}</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaLabel}>MEDIA</Text>
            <Text style={styles.heroMetaValue}>{imageCount}</Text>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaCell}>
            <Text style={styles.heroMetaLabel}>SKUS</Text>
            <Text style={styles.heroMetaValue}>{variantCount}</Text>
          </View>
        </View>
      </LinearGradient>

      {isCreateFlow ? (
        <View style={styles.steps}>
          {[
            { n: '1', label: 'CORE', on: true },
            { n: '2', label: 'MEDIA', on: false },
            { n: '3', label: 'SKUS', on: false },
          ].map((step, i) => (
            <View key={step.label} style={styles.stepItem}>
              {i > 0 ? <View style={styles.stepLine} /> : null}
              <View style={[styles.stepDot, step.on && styles.stepDotOn]}>
                <Text style={[styles.stepNum, step.on && styles.stepNumOn]}>{step.n}</Text>
              </View>
              <Text style={[styles.stepLabel, step.on && styles.stepLabelOn]}>{step.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toastBar}>
          <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
          <Text style={styles.toast}>{toast}</Text>
        </View>
      ) : null}
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Section kicker="01" title="BASICS" hint="Name and story shown on the product page.">
        <AppInput
          label="Product name"
          value={name}
          onChangeText={setName}
          placeholder="Core Oversized Tee"
        />
        <AppInput
          label="Subtitle"
          value={subtitle}
          onChangeText={setSubtitle}
          placeholder="Heavyweight cotton · gym staple"
        />
        <AppInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Short product story for members"
          multiline
        />
      </Section>

      <Section kicker="02" title="PRICING & STATUS">
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Price (€)"
              value={priceEuros}
              onChangeText={setPriceEuros}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppInput
              label="Compare at (€)"
              value={compareEuros}
              onChangeText={setCompareEuros}
              keyboardType="decimal-pad"
              placeholder="Optional"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>PUBLISH STATUS</Text>
        <ChoiceChips
          options={STATUSES.map((s) => ({ id: s, label: s.toUpperCase() }))}
          value={status}
          onChange={(id) => setStatus((id as StoreProductStatus) ?? 'draft')}
        />

        <Text style={styles.fieldLabel}>CATEGORY</Text>
        <ChoiceChips
          options={categories.map((c) => ({ id: c.id, label: c.name.toUpperCase() }))}
          value={categoryId}
          onChange={setCategoryId}
        />

        {collections.length > 0 ? (
          <>
            <Text style={styles.fieldLabel}>COLLECTION</Text>
            <ChoiceChips
              options={collections.map((c) => ({ id: c.id, label: c.name.toUpperCase() }))}
              value={collectionId}
              onChange={setCollectionId}
              allowClear
            />
          </>
        ) : null}

        {sizeGuides.length > 0 ? (
          <>
            <Text style={styles.fieldLabel}>SIZE GUIDE</Text>
            <ChoiceChips
              options={sizeGuides.map((g) => ({ id: g.id, label: g.name.toUpperCase() }))}
              value={sizeGuideId}
              onChange={setSizeGuideId}
              allowClear
            />
          </>
        ) : null}
      </Section>

      <Section
        kicker="03"
        title="MERCHANDISING"
        hint="Tap badges that should appear on store cards.">
        <View style={styles.flagGrid}>
          {FLAGS.map((flag) => {
            const on = flagValues[flag.key];
            return (
              <Pressable
                key={flag.key}
                onPress={() => setFlag(flag.key, !on)}
                style={[styles.flagCard, on && styles.flagCardOn]}>
                <View style={styles.flagTop}>
                  <Text style={[styles.flagLabel, on && styles.flagLabelOn]}>{flag.label}</Text>
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={on ? colors.accent : colors.textMuted}
                  />
                </View>
                <Text style={styles.flagHint}>{flag.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Pressable
        disabled={saving}
        onPress={() => void save()}
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.92 }]}>
        <Ionicons name="save-outline" size={18} color={colors.background} />
        <Text style={styles.saveBtnText}>
          {saving ? 'SAVING…' : isCreateFlow ? 'CREATE PRODUCT' : 'SAVE PRODUCT'}
        </Text>
      </Pressable>

      <Pressable onPress={() => setShowSpecs((v) => !v)} style={styles.optionalToggle}>
        <Text style={styles.optionalToggleText}>
          {showSpecs ? 'HIDE SPECS' : 'ADD SPECS (OPTIONAL)'}
        </Text>
        <Ionicons
          name={showSpecs ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </Pressable>

      {showSpecs ? (
        <Section kicker="04" title="SPECS" hint="Shown in the product details panel.">
          <AppInput
            label="Product details"
            value={details}
            onChangeText={setDetails}
            multiline
            placeholder="Fit, weight, construction…"
          />
          <AppInput
            label="Materials"
            value={materials}
            onChangeText={setMaterials}
            multiline
            placeholder="e.g. 100% cotton, 280gsm"
          />
          <AppInput
            label="Care instructions"
            value={care}
            onChangeText={setCare}
            multiline
            placeholder="Wash cold, hang dry…"
          />
          {!isCreateFlow ? (
            <Pressable
              disabled={saving}
              onPress={() => void save()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.secondaryBtnText}>SAVE SPECS</Text>
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      {isCreateFlow ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextKicker}>AFTER CREATE</Text>
          <Text style={styles.nextTitle}>Images + variants unlock next</Text>
          <Text style={styles.nextBody}>
            Save this piece first. You’ll land on the editor to upload shots and generate size/color
            SKUs.
          </Text>
        </View>
      ) : (
        <>
          <Section
            kicker="05"
            title="IMAGES"
            hint="Upload gallery shots. First image becomes primary.">
            {(product?.images ?? []).length > 0 ? (
              <View style={styles.imageRow}>
                {(product?.images ?? []).map((img) => (
                  <View key={img.id} style={styles.imageCard}>
                    <MediaImage uri={img.public_url} style={styles.image} rounded={3} />
                    {img.is_primary ? (
                      <View style={styles.primaryTag}>
                        <Text style={styles.primaryTagText}>PRIMARY</Text>
                      </View>
                    ) : null}
                    <View style={styles.imageActions}>
                      <Pressable
                        onPress={async () => {
                          if (!product) return;
                          await store.setPrimaryImage(product.id, img.id);
                          await refreshProduct(product.id);
                        }}>
                        <Text
                          style={[styles.imgAction, img.is_primary && { color: colors.accent }]}>
                          {img.is_primary ? 'PRIMARY' : 'SET PRIMARY'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          await store.deleteProductImage(img);
                          if (product) await refreshProduct(product.id);
                        }}>
                        <Text style={[styles.imgAction, { color: colors.danger }]}>DELETE</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>No images yet.</Text>
            )}
            <Pressable
              disabled={saving}
              onPress={() => void pickImage()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
              <Ionicons name="image-outline" size={16} color={colors.accent} />
              <Text style={styles.secondaryBtnText}>UPLOAD IMAGE</Text>
            </Pressable>
          </Section>

          <Section
            kicker="06"
            title="VARIANTS"
            hint="Tap colors and sizes, then generate SKUs. Stock is managed in Inventory.">
            <AppInput label="SKU prefix" value={skuPrefix} onChangeText={setSkuPrefix} />

            <Text style={styles.fieldLabel}>COLORS</Text>
            <View style={styles.chips}>
              {QUICK_COLORS.map((c) => {
                const on = selectedColors.some((x) => x.toLowerCase() === c.toLowerCase());
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColorsInput((prev) => toggleInCsv(prev, c))}
                    style={[styles.chip, on && styles.chipActive]}>
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>
                      {c.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <AppInput
              label="Colors (edit list)"
              value={colorsInput}
              onChangeText={setColorsInput}
              placeholder="Black, White"
            />

            <Text style={styles.fieldLabel}>SIZES</Text>
            <View style={styles.chips}>
              {QUICK_SIZES.map((s) => {
                const on = selectedSizes.some((x) => x.toLowerCase() === s.toLowerCase());
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSizesInput((prev) => toggleInCsv(prev, s))}
                    style={[styles.chip, on && styles.chipActive]}>
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
            <AppInput
              label="Sizes (edit list)"
              value={sizesInput}
              onChangeText={setSizesInput}
              placeholder="S, M, L, XL"
            />

            <Text style={styles.comboHint}>
              Will create {selectedColors.length * selectedSizes.length} SKU combinations
            </Text>

            <Pressable
              disabled={saving}
              onPress={() => void generate()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
              <Ionicons name="grid-outline" size={16} color={colors.accent} />
              <Text style={styles.secondaryBtnText}>GENERATE COMBINATIONS</Text>
            </Pressable>

            {variantCount > 0 ? (
              <View style={styles.variantList}>
                {product!.variants!.map((v) => (
                  <View key={v.id} style={styles.variantRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.variantTitle}>
                        {[v.color_label, v.size_label].filter(Boolean).join(' / ') || v.sku}
                      </Text>
                      <Text style={styles.variantMeta}>
                        {v.sku} · {v.stock_qty} in stock
                        {v.price_override_cents != null
                          ? ` · ${formatStoreMoney(v.price_override_cents)}`
                          : ''}
                      </Text>
                    </View>
                    <View style={[styles.stockPill, v.stock_qty <= 0 && styles.stockPillEmpty]}>
                      <Text
                        style={[
                          styles.stockPillText,
                          v.stock_qty <= 0 && styles.stockPillTextEmpty,
                        ]}>
                        {v.stock_qty <= 0 ? 'OUT' : v.stock_qty}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>
                No variants yet — pick colors/sizes and generate.
              </Text>
            )}

            <Pressable
              onPress={() => router.push('/(coach)/admin/store/inventory')}
              style={styles.linkRow}>
              <Text style={styles.linkText}>OPEN INVENTORY TO SET STOCK</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.accent} />
            </Pressable>
          </Section>

          <Pressable onPress={() => void archive()} style={styles.archiveBtn}>
            <Text style={styles.archiveText}>ARCHIVE PRODUCT</Text>
          </Pressable>
        </>
      )}

      <View style={{ height: spacing.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    gap: 10,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
  },
  heroLead: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepLine: {
    width: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginRight: 2,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepDotOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.16)',
  },
  stepNum: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  stepNumOn: { color: colors.accent },
  stepLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  stepLabelOn: { color: colors.text },
  optionalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.md,
    paddingVertical: 8,
  },
  optionalToggleText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  nextCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(200,255,0,0.06)',
    gap: 6,
  },
  nextKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  nextTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
  },
  nextBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  heroMeta: {
    marginTop: 4,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 12,
  },
  heroMetaCell: { flex: 1, gap: 3 },
  heroMetaDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },
  heroMetaLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: colors.textMuted,
  },
  heroMetaValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  heroMetaAccent: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 20,
    color: colors.accent,
  },
  toastBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  toast: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.accent,
  },
  formError: {
    fontFamily: fonts.sans,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
  },
  sectionKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  sectionTitle: {
    marginTop: 2,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  sectionHint: {
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  sectionRule: {
    height: 2,
    width: 36,
    backgroundColor: colors.accent,
    marginTop: 10,
    marginBottom: 14,
    opacity: 0.85,
  },
  sectionBody: { gap: 12 },
  row2: { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: {
    marginTop: 4,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: {
    borderColor: 'rgba(200,255,0,0.55)',
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  chipText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.accent },
  flagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    gap: 4,
  },
  flagCardOn: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  flagTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  flagLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  flagLabelOn: { color: colors.accent },
  flagHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  saveBtn: {
    minHeight: 52,
    marginBottom: spacing.lg,
    borderRadius: 2,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 1.6,
    color: colors.background,
  },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  btnDisabled: { opacity: 0.4 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    position: 'relative',
  },
  image: { width: '100%', aspectRatio: 3 / 4 },
  primaryTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  primaryTagText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.background,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  imgAction: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  comboHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  variantList: { gap: 8, marginTop: 4 },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  variantTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  variantMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  stockPill: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 2,
    alignItems: 'center',
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  stockPillEmpty: {
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderColor: 'rgba(255,77,77,0.35)',
  },
  stockPillText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.accent,
  },
  stockPillTextEmpty: { color: colors.danger },
  emptyHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  linkText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  archiveBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
  },
  archiveText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.danger,
  },
});
