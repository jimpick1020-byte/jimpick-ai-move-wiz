import type { OptionItem } from "@/lib/jimpick";
import { Icon3D } from "@/lib/jimpick-icon3d";
import { ItemArt } from "@/lib/jimpick-art";

export function OptionArt({ option, size = 44 }: { option: OptionItem; size?: number }) {
  return option.imageUrl
    ? <Icon3D src={option.imageUrl} alt={option.name} size={size} />
    : <ItemArt id={option.catalogItemId} name={option.name} size={size} />;
}