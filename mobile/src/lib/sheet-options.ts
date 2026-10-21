import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

type ScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;
type Detents = number[] | 'fitToContents';

/** Native form sheet (UISheetPresentationController / Material bottom sheet). */
export function formSheet(detents: Detents): Extract<ScreenOptions, object> {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
    sheetInitialDetentIndex: 0,
    contentStyle: { backgroundColor: 'transparent' },
  } as Extract<ScreenOptions, object>;
}

/** Applied to any `sheets/*` route that is not declared explicitly. */
export const sheetDefaults = formSheet([0.6, 1]);

/** Transparent route that draws its own web-shaped overlay with `OverlayScreen` from `@/ui`. */
export const overlayScreen = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as Extract<ScreenOptions, object>;
