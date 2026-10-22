import { Volume2, VolumeX } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { createStyles } from '@/theme';

import { setCasinoSoundMuted, useCasinoSoundMuted } from '../../shared/audio';
import { rgba, tw } from '../../shared/casinoTheme';

/** Mute switch over the wheel (web `handleToggleSound`), bound to the `casinoSound` preference. */
export function SoundToggle() {
  const styles = useStyles();
  const muted = useCasinoSoundMuted();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Włącz dźwięki' : 'Wycisz dźwięki'}
      onPress={() => setCasinoSoundMuted(!muted)}
      style={styles.button}
    >
      {muted ? <VolumeX size={16} color={rgba(tw.white, 0.6)} /> : <Volume2 size={16} color={rgba(tw.white, 0.6)} />}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  // `absolute right-1 top-20 z-30 flex h-11 w-11 rounded-xl border border-white/10 bg-black/45 backdrop-blur-sm`
  button: {
    position: 'absolute',
    right: 4,
    top: 80,
    zIndex: 30,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
    backgroundColor: rgba(tw.black, 0.45),
  },
}));
