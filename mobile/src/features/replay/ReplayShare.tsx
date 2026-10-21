import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Check, Download, RefreshCw, Share2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { env } from '@/lib/env';
import { toast } from '@/lib/toast';
import { createStyles, useTheme, type SchemeName } from '@/theme';
import { Button, Text } from '@/ui';
import type { ReplayModel } from './model';
import { createReplayPoster, deletePosterFile, writePosterFile } from './poster';

const POSTER_PREVIEW_WIDTH = 180;

/** "Udostępnij": on-device PNG poster in a native sheet (web dialog). */
export function ReplayShare({ model, username }: { model: ReplayModel; username: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        style={styles.trigger}
        accessibilityLabel="Udostępnij"
        icon={<Share2 size={16} color={colors.foreground} />}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.header}>
              <Text size="lg" weight="600" style={styles.title} accessibilityRole="header">Udostępnij podsumowanie</Text>
              <Text color="mutedForeground">PNG powstaje na tym urządzeniu. Nick jest opcjonalny.</Text>
            </View>
            {open ? <PosterPreview model={model} username={username} /> : null}
          </ScrollView>
          <Button
            variant="ghost"
            size="icon"
            style={styles.close}
            accessibilityLabel="Zamknij"
            icon={<X size={16} color={colors.foreground} />}
            onPress={() => setOpen(false)}
          />
        </View>
      </Modal>
    </>
  );
}

interface PosterResult {
  name: string | undefined;
  model: ReplayModel;
  scheme: SchemeName;
  attempt: number;
  base64: string | null;
}

function PosterPreview({ model, username }: { model: ReplayModel; username: string }) {
  const styles = useStyles();
  const palette = useTheme();
  const { colors, scheme } = palette;
  const [includeName, setIncludeName] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<PosterResult | null>(null);
  const [sharing, setSharing] = useState(false);
  const name = includeName ? username : undefined;
  // Only a result for the current inputs counts: a stale poster never shows or shares.
  const current = result && result.name === name && result.model === model && result.scheme === scheme && result.attempt === attempt ? result : null;
  const poster = current?.base64 ?? null;
  const error = current !== null && current.base64 === null;

  useEffect(() => {
    let cancelled = false;
    createReplayPoster(model, palette.colors, name)
      .then((base64) => {
        if (!cancelled) setResult({ name, model, scheme: palette.scheme, attempt, base64 });
      })
      .catch(() => {
        if (!cancelled) setResult({ name, model, scheme: palette.scheme, attempt, base64: null });
      });
    return () => {
      cancelled = true;
    };
  }, [model, name, palette, attempt]);

  // Closing the sheet drops the exported file (web: revokeObjectURL).
  useEffect(() => deletePosterFile, []);

  const shareLink = async () => {
    const url = `${env.webUrl}/replay`;
    await Share.share(Platform.OS === 'ios' ? { title: 'BSPLIC Replay', message: 'BSPLIC Replay', url } : { title: 'BSPLIC Replay', message: `BSPLIC Replay ${url}` });
  };

  const sharePoster = async (dialogTitle: string) => {
    if (!poster || sharing) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        await shareLink();
        return;
      }
      const file = await writePosterFile(poster).catch(() => null);
      if (!file) {
        await shareLink();
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
    } catch {
      toast.error('Udostępnianie nie powiodło się. Możesz zapisać PNG.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <View style={styles.preview} accessibilityState={{ busy: !poster && !error }}>
        {poster ? (
          <Image
            source={{ uri: `data:image/png;base64,${poster}` }}
            style={styles.posterImage}
            contentFit="contain"
            cachePolicy="none"
            accessibilityLabel={`Podgląd podsumowania${includeName ? ` gracza ${username}` : ' bez nicku'}`}
          />
        ) : (
          <Text color="mutedForeground" align="center" style={styles.previewStatus} accessibilityLiveRegion="polite">
            {error ? 'Podgląd niedostępny' : 'Przygotowywanie…'}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: includeName }}
        onPress={() => setIncludeName((value) => !value)}
        style={styles.consent}
      >
        <View style={[styles.checkbox, includeName && styles.checkboxChecked]}>
          {includeName ? <Check size={12} strokeWidth={3} color={colors.background} /> : null}
        </View>
        <Text>Dodaj mój nick</Text>
      </Pressable>
      {error ? (
        <View style={styles.errorBlock} accessibilityRole="alert">
          <Text>Nie udało się utworzyć podsumowania.</Text>
          <Button
            variant="outline"
            label="Spróbuj ponownie"
            icon={<RefreshCw size={16} color={colors.foreground} />}
            onPress={() => setAttempt((value) => value + 1)}
          />
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          label="Zapisz PNG"
          icon={poster ? <Download size={16} color={colors.secondaryForeground} /> : undefined}
          disabled={!poster || sharing}
          style={styles.action}
          onPress={() => void sharePoster('Zapisz PNG')}
        />
        <Button
          variant="outline"
          label="Wyślij"
          icon={<Share2 size={16} color={colors.foreground} />}
          disabled={!poster || sharing}
          style={styles.action}
          onPress={() => void sharePoster('BSPLIC Replay')}
        />
      </View>
    </>
  );
}

const useStyles = createStyles(({ colors }) => ({
  trigger: { width: 44, height: 44, paddingHorizontal: 0 },
  sheet: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  header: { gap: 6, paddingRight: 40 },
  title: { lineHeight: 18, letterSpacing: -0.45 },
  close: { position: 'absolute', right: 8, top: 8, width: 44, height: 44 },
  preview: { minHeight: 96, alignItems: 'center', justifyContent: 'center' },
  posterImage: {
    width: POSTER_PREVIEW_WIDTH,
    height: (POSTER_PREVIEW_WIDTH * 1920) / 1080,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  previewStatus: { paddingVertical: 32 },
  consent: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.mutedForeground,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  errorBlock: { gap: 12, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { height: 44 },
}));
