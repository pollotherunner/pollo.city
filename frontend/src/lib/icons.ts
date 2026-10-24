import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  Upload,
  X,
  createIcons,
} from "lucide";

const icons = {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image: ImageIcon,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  Upload,
  X,
};

export function refreshIcons(root: Element | Document | DocumentFragment = document): void {
  createIcons({ icons, root });
}
