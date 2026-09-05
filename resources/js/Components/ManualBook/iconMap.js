import {
  Boxes,
  FileText,
  HandCoins,
  Handshake,
  Package,
  Receipt,
  Settings2,
  ShoppingBag,
  TicketsIcon,
  Undo2,
  Wrench,
} from "lucide-react";

const iconMap = {
  Receipt,
  ShoppingBag,
  Package,
  HandCoins,
  Wrench,
  Boxes,
  Handshake,
  TicketsIcon,
  Undo2,
  Settings2,
  FileText,
};

export default function resolveManualBookIcon(name) {
  return iconMap[name] ?? FileText;
}
