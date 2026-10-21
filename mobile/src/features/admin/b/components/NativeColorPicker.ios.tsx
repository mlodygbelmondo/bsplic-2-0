import { ColorPicker, Host } from '@expo/ui/swift-ui';

/** SwiftUI `ColorPicker` row (the system picker web Safari also opens for `<input type="color">`). */
export function NativeColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <ColorPicker label="Kolor" selection={value} supportsOpacity={false} onSelectionChange={onChange} />
    </Host>
  );
}
