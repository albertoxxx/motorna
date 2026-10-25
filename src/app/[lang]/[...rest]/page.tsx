import { notFound } from "next/navigation";

/** Any unknown path under a locale renders the branded, localized 404 (inside the site layout). */
export default function CatchAll() {
  notFound();
}
