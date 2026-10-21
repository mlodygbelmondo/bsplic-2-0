/** No system color picker outside iOS; the sheet's presets and hex field cover it. */
export function NativeColorPicker(_props: { value: string; onChange: (value: string) => void }) {
  return null;
}
